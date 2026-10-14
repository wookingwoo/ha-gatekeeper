/* Supervisor renames only the main declaration. Resolve its installed name at
 * runtime, then intersect it with its own child before executing the connector.
 * No capabilities, profile replacement, unconfined fallback or shell required. */
#include <ctype.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

/* Compile-time fixture paths are used by launcher-test.py; no runtime override. */
#ifndef APPARMOR_CURRENT
#define APPARMOR_CURRENT "/proc/self/attr/apparmor/current"
#endif
#ifndef CONNECTOR_BINARY
#define CONNECTOR_BINARY "/usr/local/libexec/cloudflared"
#endif

static int fail(void) {
    fputs("cloudflared: enforcing HA Gatekeeper AppArmor stack required\n", stderr);
    return 126;
}

int main(int argc, char **argv) {
    (void)argc;
    char label[4096], command[4160];
    int fd = open(APPARMOR_CURRENT, O_RDONLY | O_CLOEXEC);
    if (fd < 0) return fail();
    ssize_t count = read(fd, label, sizeof(label) - 1);
    char extra;
    ssize_t remaining = read(fd, &extra, 1);
    close(fd);
    if (count <= 0 || remaining != 0 || memchr(label, '\0', (size_t)count)) return fail();
    label[count] = '\0';
    const char suffix[] = " (enforce)\n";
    size_t length = (size_t)count;
    if (length <= sizeof(suffix)-1 || strcmp(label + length - (sizeof(suffix)-1), suffix)) return fail();
    label[length -= sizeof(suffix)-1] = '\0';
    const char addon[] = "ha_gatekeeper";
    size_t addon_length = sizeof(addon)-1;
    if (length < addon_length || strcmp(label + length-addon_length, addon) ||
        (length > addon_length && label[length-addon_length-1] != '_')) return fail();
    /* Reject namespaces, existing compound/child labels, whitespace and syntax. */
    for (size_t i=0; i<length; ++i)
        if (!isalnum((unsigned char)label[i]) && label[i] != '_') return fail();
    int size = snprintf(command, sizeof(command), "stack %s//cloudflared", label);
    if (size < 0 || (size_t)size >= sizeof(command)) return fail();
    fd = open(APPARMOR_CURRENT, O_WRONLY | O_CLOEXEC);
    if (fd < 0) return fail();
    /* A proc attribute command is one write. Never retry a partial transition. */
    ssize_t written = write(fd, command, (size_t)size);
    close(fd);
    if (written != size) return fail();
    argv[0] = CONNECTOR_BINARY;
    execv(CONNECTOR_BINARY, argv);
    return fail();
}
