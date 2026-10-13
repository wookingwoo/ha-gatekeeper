#!/usr/bin/env python3
"""Offline parser + Supervisor 2026.10.0 / OS Agent 1.14.0 loader regression.

No kernel enforcement is claimed. Uses a local AppArmor 3.0.8 parser image
and its 3.0 kernel feature ABI (including domain/stack and post_nnp_subset),
available in Linux 6.1/6.6/6.12, instead of this host's absent kernel interface.
"""
import os
from pathlib import Path
import re
import subprocess
import sys

profile = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'apparmor.txt'
source = profile.read_text()
image = os.environ.get('APPARMOR_PARSER_IMAGE', 'ha-gatekeeper:apparmor-parser')
env = {k: v for k, v in os.environ.items() if k not in
       ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']}
command = ['docker', '--host=unix:///var/run/docker.sock', 'run', '--rm', '-i',
           '--network', 'none', '--cap-drop', 'ALL', '--entrypoint', 'apparmor_parser', image]

version = subprocess.run(command + ['--version'], capture_output=True, env=env, check=True, timeout=30)
assert b'3.0.8' in version.stdout, version.stdout

def parse(text, *args):
    result = subprocess.run(command + list(args) + ['--kernel-features', '/etc/apparmor.d/abi/3.0', '/dev/stdin'], input=text.encode(),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=30)
    assert result.returncode == 0, result.stderr.decode()
    return result.stdout

# Exact declaration recognition/replacement from pinned Supervisor utils/apparmor.py.
pattern = re.compile(r'^profile ([^ ]+).*$')
originals = {m.group(1) for line in source.splitlines(True) if (m := pattern.match(line))}
assert len(originals) == 1, 'Supervisor requires one column-zero profile'
original = originals.pop()
for parent in [original, 'local_ha_gatekeeper', 'ab123456_ha_gatekeeper']:
    rewritten = ''.join(line.replace(original, parent, 1) if pattern.match(line) else line
                        for line in source.splitlines(True))
    names = parse(rewritten, '--names', '--skip-cache').decode().splitlines()
    # Exact OS Agent checkProfileNames contract: own parent + descendants only.
    assert parent in names and all(n == parent or n.startswith(parent+'//') for n in names), names
    assert set(names) == {parent, parent+'//cloudflared'}, names
    compiled = parse(rewritten, '-Q', '-S')
    assert (parent+'//cloudflared').encode()+b'\0' in compiled
    # The launcher performs kernel STACK; no named exec transition is needed.
    # Catch the old parent//&cloudflared target even though its syntax parsed.
    assert b'xtable\0' not in compiled, 'unexpected named exec table: potential replacement/fallback'
    expanded = parse(rewritten, '-p').decode()
    assert 'change_profile -> &{ha_gatekeeper,*_ha_gatekeeper}//cloudflared,' in expanded
    assert 'owner /proc/[0-9]*/attr/apparmor/current w,' in expanded
    assert not re.search(r'\b(?:[pPcC][iuU]?x|ux)\b', expanded)
    child = expanded.split('profile cloudflared ', 1)[1]
    assert 'change_profile' not in child
    assert '/usr/local/libexec/cloudflared mrix,' in child
    assert 'deny /usr/local/bin/cloudflared x,' in child
    for path in ['/data{,/**}', '/app{,/**}']:
        assert 'deny '+path+' rwklmx,' in child
    print(parent+': compiled parent/child only, no exec xtable/fallback, stack permission retained')
print('Offline only: real enforcing-kernel launcher/connector verification is still required.')
