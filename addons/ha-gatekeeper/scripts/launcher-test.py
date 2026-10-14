#!/usr/bin/env python3
"""Exercise the real launcher with compile-time fixture paths, never host proc writes."""
import pathlib
import subprocess
import tempfile
import sys

source = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[1] / 'cloudflared-launcher.c'
with tempfile.TemporaryDirectory(prefix='hgk-launcher-') as directory:
    root = pathlib.Path(directory)
    current, binary = root / 'current', root / 'launcher'
    subprocess.run(['cc', '-Wall', '-Wextra', '-Werror', '-O2',
                    f'-DAPPARMOR_CURRENT="{current}"', '-DCONNECTOR_BINARY="/bin/echo"',
                    str(source), '-o', str(binary)], check=True)
    for parent in ['ha_gatekeeper', 'local_ha_gatekeeper', 'ab123456_ha_gatekeeper']:
        current.write_text(parent + ' (enforce)\n')
        result = subprocess.run([binary, 'connector-argument'], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        assert result.stdout == 'connector-argument\n'
        assert current.read_bytes() == ('stack ' + parent + '//cloudflared').encode()
    for label in ['unconfined\n', 'local_ha_gatekeeper (complain)\n',
                  'docker-default (enforce)\n', 'other_app (enforce)\n',
                  'local_ha_gatekeeper//&other (enforce)\n', 'local_ha_gatekeeper (enforce)',
                  'local_ha_gatekeeper (enforce)\nextra', 'local_ha_gatekeeper\0 (enforce)\n',
                  ' (enforce)\n', '', 'x'*8192]:
        current.write_text(label)
        result = subprocess.run([binary, 'MUST-NOT-EXECUTE'], capture_output=True, text=True)
        assert result.returncode != 0 and not result.stdout, label
        assert current.read_text() == label
    current.write_text('local_ha_gatekeeper (enforce)\n')
    current.chmod(0o400)
    result = subprocess.run([binary, 'MUST-NOT-EXECUTE'], capture_output=True, text=True)
    assert result.returncode != 0 and not result.stdout, 'failed STACK must prevent exec'
    current.chmod(0o600)
    current.unlink()
    result = subprocess.run([binary, 'MUST-NOT-EXECUTE'], capture_output=True, text=True)
    assert result.returncode != 0 and not result.stdout
print('launcher: installed-name stacking, arguments, malformed/truncated labels and failed STACK fail closed')
