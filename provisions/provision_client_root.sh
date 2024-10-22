#!/bin/bash
apt-get update
apt-get upgrade -yq
apt-get install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs xvfb x11vnc fvwm \
    #linux-generic linux-modules-extra-$(uname -r) dkms
mkdir ~/project_node_modules
mount --bind ~/project_node_modules /opt/mediasoup-LLLS-experiments/client/node_modules
wget -c https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt-get install -f -yq ./google-chrome-stable_current_amd64.deb
apt-get install -f -yq
rm -f google-chrome-stable_current_amd64.deb
# Give syslog and /var/log permissions to vagrant user
usermod -aG adm vagrant
chown -R vagrant:vagrant /var/log