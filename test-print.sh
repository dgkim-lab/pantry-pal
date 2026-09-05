#!/bin/bash

set -o allexport
source .env
set -o allexport-

if [ -z "$RECEIPT_INTERNAL_TOKEN" ];
then
    echo "RECEIPT_INTERNAL_TOKEN is not set"
    exit 1
fi

echo "$RECEIPT_INTERNAL_TOKEN"

echo "Enter purchaseId (for localhost)"
read PURCHASE_ID
echo "Enter XPrinter IP"
read XPRINTER_IP

echo python3 worker/test-xprinter.py \
    --purchase-id "$PURCHASE_ID" \
    --api-url "http://localhost:3000" \
    --token "$RECEIPT_INTERNAL_TOKEN" \
    --host "$XPRINTER_IP"

