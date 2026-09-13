# Marketing Data interface on Netlify

Client source is copied from the tested `marketingdata-dashboard` revision
`15650cfed37f4d7d0384be1ede95ffe0bd4db11e`. The unused next/dynamic import is removed,
and compressed emblem assets use the local Netlify asset path.

`npm run build` at the repository root builds this interface and the main website.
The existing `/marketingdata` server route first validates access through the established
dashboard service, then returns this interface for the workspace, admin and connections pages.
Login, encrypted credentials, provider imports, OAuth callbacks, PIN checks and reports remain
in the existing authenticated backend. No database or connection secrets are copied here.

The generated static interface contains no private data. Every data request is authenticated
by the backend even if someone directly opens `/marketingdata-ui/index.html`.

Future dashboard interface edits must be synchronized here before deploying Netlify.
Backend edits still require a backend deployment; pushing frontend code cannot publish them.
