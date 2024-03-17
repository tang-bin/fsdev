#!/bin/bash

rm -rf /opt/fsdev
mkdir -p /opt/fsdev
cp -R ./dist/bin/* /opt/fsdev

echo "#!/usr/bin/env node" >/opt/fsdev/fs
echo "require(\"/opt/fsdev/index.js\");" >>/opt/fsdev/fs
chmod +x /opt/fsdev/fs

echo "fsdev installed to /opt/fsdev"
echo "run \"/opt/fsdev/fs\" or add to PATH"
