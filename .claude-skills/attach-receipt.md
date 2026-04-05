---
name: attach-receipt
description: Attach a PDF receipt or invoice to a Xero transaction. Searches Gmail if no file path given.
user_invocable: true
---

Attach a receipt/invoice PDF to a Xero bill or invoice.

## Usage
```
/attach-receipt INV-0042 ~/Drop/spark-invoice.pdf
/attach-receipt INV-0042                          # searches Gmail for matching receipt
/attach-receipt                                    # interactive — asks what to attach where
```

## Steps

### 1. Parse arguments
- First arg: Xero invoice/bill number (e.g. INV-0042) — optional
- Second arg: local file path — optional
- If no invoice number: use Xero API to show recent unpaid bills, ask Ra to pick
- If no file path: search Gmail (accounts@, kiaora@) for matching supplier + amount

### 2. Find the receipt file
If a file path was given:
- Verify it exists
- If it's an image (jpg/png), convert to PDF: `sips -s format pdf {input} --out /tmp/{output}.pdf` (macOS native)

If no file path — search Gmail:
- Get the invoice details from Xero (supplier name, amount, date)
- Search Gmail across accounts@reservetamaki.nz and kiaora@reservetamaki.nz using Gmail MCP
- Search query: supplier name + approximate amount
- If attachment found, save to ~/Drop/xero-attachments/

### 3. Get Xero credentials from platform DB
The platform stores Xero OAuth tokens in the `xero_settings` table. Query directly:

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT access_token, refresh_token, xero_tenant_id, xero_client_id, xero_client_secret, token_expires_at, connected FROM xero_settings LIMIT 1\")
  .then(r => { console.log(JSON.stringify(r.rows[0])); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"
```

The DATABASE_URL is in the .env file. Read it first if needed.

If the token is expired (check token_expires_at), refresh it:
```bash
TOKEN=$(curl -s -X POST https://identity.xero.com/connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n '$CLIENT_ID:$CLIENT_SECRET' | base64)" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN")
```
Then update the DB with the new tokens.

If connected=false or no tokens exist: tell Ra to reconnect Xero in the platform settings page (/xero-settings).

### 4. Find the invoice ID
```bash
curl -s "https://api.xero.com/api.xro/2.0/Invoices?InvoiceNumbers=$INVOICE_NUMBER" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "xero-tenant-id: $TENANT_ID" \
  -H "Accept: application/json"
```

Extract the InvoiceID from the response.

### 5. Upload the attachment
```bash
curl -s -X PUT \
  "https://api.xero.com/api.xro/2.0/Invoices/$INVOICE_ID/Attachments/$FILENAME" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "xero-tenant-id: $TENANT_ID" \
  -H "Content-Type: application/pdf" \
  --data-binary @"$FILE_PATH"
```

For bank transactions instead of invoices:
```
https://api.xero.com/api.xro/2.0/BankTransactions/$BANK_TRANSACTION_ID/Attachments/$FILENAME
```

### 6. Confirm
- Show: "Attached {filename} to {invoice number} ({supplier name})"
- Include the Xero deep link: https://go.xero.com/AccountsPayable/View.aspx?InvoiceID={invoice_id}

## Scope rules
- ALWAYS confirm with Ra before uploading — show filename + destination
- Never delete or overwrite existing attachments without asking
- If auth fails with 403, tell Ra to reconnect Xero at /xero-settings (scopes may need updating)

## Error handling
- Token expired → refresh using the refresh_token from DB, update DB with new tokens
- 403 Forbidden → scopes missing, Ra needs to reconnect Xero at /xero-settings
- 404 → invoice number not found, double check
- File >10MB → warn Ra, Xero limit is 10MB per attachment
- No tokens in DB → Ra needs to connect Xero at /xero-settings first
