#!/bin/bash
cd /opt/mediasoup-LLLS-experiments/client
corepack enable pnpm
corepack use pnpm
pnpm install >> /var/log/provision_client_user.log 2>&1
if [ "$MLE_DEV" = "true" ]; then
    pnpm run dev >> /var/log/provision_client_user.log 2>&1 &
else
    pnpm run build >> /var/log/provision_client_user.log 2>&1
    pnpm run start >> /var/log/provision_client_user.log 2>&1 &
fi