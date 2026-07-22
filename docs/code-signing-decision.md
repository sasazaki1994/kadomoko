# KadoMoco v0.1.0 code-signing decision

## Current decision

v0.1.0 is **unsigned unless the release job is explicitly supplied a certificate**. An unsigned RC may be shared only when automated qualification passes, Windows real-device QA evidence is reviewed, SHA-256 values are published through `rc-manifest.json`, and the download page clearly warns that Windows SmartScreen can appear. Users should download only from the project's GitHub Releases page and compare `Get-FileHash .\KadoMoco-0.1.0-x64.exe -Algorithm SHA256` with the manifest before choosing SmartScreen's **More info / Run anyway**. Never disable SmartScreen or Defender globally.

The ZIP container is not expected to carry an Authenticode signature; `KadoMoco.exe` inside it and the NSIS installer are the objects checked with `Get-AuthenticodeSignature`.

## Automation contract

`electron-builder` uses its standard `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables. They are CI secrets, never files or values committed to Git. Ordinary CI and RC qualification permit unsigned artifacts. Set `KADOMOCO_REQUIRE_CODE_SIGNING=1` for a release where signing is mandatory; package verification must then fail unless Authenticode is valid. In normal mode `NotSigned` is a warning. Reports use `not-signed`/null certificate fields when absent and record `signingStatus`, `signatureStatus`, certificate subject, thumbprint, expiry, and timestamp presence when available.

## Adoption and custody

Signing becomes mandatory after the project obtains an organization-controlled Windows code-signing certificate, has a named release owner and recovery owner, and has validated timestamping and revocation procedures in a dry run. The certificate is held in the CI provider's protected secret store or a managed signing/HSM service with least-privilege release access; it is never placed in the repository or developer documentation. Rotate before expiry and on personnel/provider changes. On suspected compromise or revocation, stop releases, revoke with the CA, remove/rotate secrets, audit affected builds, publish checksums and a security notice, and rebuild with the replacement identity.

Steam builds follow Steam's packaging/trust process and are not assumed to confer Authenticode trust on standalone binaries. GitHub Releases must remain draft until qualification evidence, checksums, and the signed/unsigned disclosure are reviewed; unsigned assets retain the explicit warning above.
