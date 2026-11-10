**English** | [Français](SECURITY.fr.md)

# Security policy

## Supported versions

Mochis is not published on npm yet and has no releases. Only the latest commit of the
`main` branch is supported. Fixes land on `main`; older commits are not patched.

| Version | Supported |
| --- | --- |
| `main` (latest) | Yes |
| Anything older | No |

## Reporting a vulnerability

Please do **not** open a public issue, discussion or pull request for a security problem.

Report it privately through GitHub instead:

1. Go to the [Security tab](https://github.com/robinnat/mochi/security) of the repository.
2. Click **Report a vulnerability** (or open
   [this form](https://github.com/robinnat/mochi/security/advisories/new) directly).
3. Describe the problem, how to reproduce it, and what an attacker could do with it.

If you cannot use the GitHub form, write to sygen.contact@gmail.com as a fallback, with "Security" in the subject.

Only the maintainers can read the report. We will look at it and answer on a best-effort
basis: this is a small project and we cannot promise a response time or a fix date. If the
report is confirmed, the fix goes to `main` through a normal pull request.

## Scope

Mochis runs in the browser and has no server, no accounts and no data storage beyond the
viewer's own `localStorage`. Reports about the code in this repository and the demo site
built from it are welcome. Issues in third-party dependencies are better reported to their
own projects.
