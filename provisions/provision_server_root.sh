#!/bin/bash
apt-get update
apt-get upgrade -yq
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
mkdir ~/project_node_modules
mount --bind ~/project_node_modules /opt/mediasoup-LLLS-experiments/server/node_modules

# Give syslog and /var/log permissions to vagrant user
usermod -aG adm vagrant
chown -R vagrant:vagrant /var/log