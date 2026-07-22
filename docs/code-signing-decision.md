# KadoMoco v0.1.0 code-signing decision

## Current decision

v0.1.0 and an emergency v0.1.1 may be distributed unsigned; obtaining a certificate is not a publication prerequisite. An unsigned RC may be shared only when automated qualification passes, Windows real-device QA evidence is reviewed, SHA-256 values for both NSIS and ZIP are published through `rc-manifest.json`, and the download page clearly warns that Windows SmartScreen can appear. Distribute only from GitHub Releases or another project-designated official source. Users should compare `Get-FileHash .\KadoMoco-0.1.0-x64.exe -Algorithm SHA256` with the manifest before choosing SmartScreen's **More info / Run anyway**. Never instruct users to disable SmartScreen or Defender.

The ZIP container is not expected to carry an Authenticode signature; `KadoMoco.exe` inside it and the NSIS installer are the objects checked with `Get-AuthenticodeSignature`.

## Automation contract

`electron-builder` uses its standard `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables. They are CI secrets, never files or values committed to Git. Ordinary CI and RC qualification permit unsigned artifacts. Set `KADOMOCO_REQUIRE_CODE_SIGNING=1` for a release where signing is mandatory; package verification must then fail unless Authenticode is valid. In normal mode `NotSigned` is a warning. Reports use `not-signed`/null certificate fields when absent and record `signingStatus`, `signatureStatus`, certificate subject, thumbprint, expiry, and timestamp presence when available.

## Adoption and custody

Re-evaluate certificate acquisition before broad public distribution, paid direct sales, sustained distribution under a company identity, v1.0, distribution independent of GitHub Releases, or when SmartScreen warnings measurably reduce installation. If adopted, signing becomes mandatory only after the project obtains an organization-controlled certificate, has a named release owner and recovery owner, and validates timestamping and revocation in a dry run. The certificate is held in the CI provider's protected secret store or a managed signing/HSM service with least-privilege release access; certificates, private keys, passwords, and Base64 certificate material are never committed. Rotate before expiry and on personnel/provider changes. On suspected compromise or revocation, stop releases, revoke with the CA, remove/rotate secrets, audit affected builds, publish checksums and a security notice, and rebuild with the replacement identity.

Steam builds follow Steam's packaging/trust process and are not assumed to confer Authenticode trust on standalone binaries. GitHub Releases must remain draft until qualification evidence, checksums, and the signed/unsigned disclosure are reviewed; unsigned assets retain the explicit warning above.
