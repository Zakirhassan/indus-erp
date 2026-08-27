# Privacy Policy — Indus ERP Collector

**Status: DRAFT — needs legal review, company details filled in, and a hosted public URL before Play Console submission.**

_Last updated: [DATE]_

This policy covers the Indus ERP Collector Android app ("the App") and the Indus ERP admin web dashboard operated by **[COMPANY / OWNER LEGAL NAME]** ("we", "us"). It explains what data the App collects, why, and how it's protected.

## Who uses this app

The App is a field-collection tool used by our staff — **collectors** and **admins** — to manage installment-plan furniture sales and record customer payment collections. It is not intended for use by the general public, and the customers described below do not install or log into the App themselves; their information is entered by our staff in the course of business.

## Information we collect

### Staff account data (App users)
- Name, work email address, and role (Collector / Admin)
- Password (stored only as a bcrypt hash — never in plain text)
- A session token, stored in the device's secure hardware-backed keystore (Android Keystore via `expo-secure-store`), not in plain app storage

### Customer data (entered by staff, about the people they serve)
- Full name, relation (e.g. son/daughter/wife/care-of) and the related person's name
- Address and phone number
- The **last 4 digits only** of an Aadhaar (Indian national ID) number, used to help disambiguate customers with similar names — we do not collect or store the full Aadhaar number
- Purchase, installment plan, and payment collection history (products purchased, amounts, dates, balances)

We do not collect device location, contacts, camera/microphone access, or advertising identifiers. The App requests no runtime permissions beyond what's needed for network access and secure storage.

## How we use this information

- To operate the installment-sale and collection workflow: recording sales, tracking payment plans, and logging each collection against the correct customer and field route
- To authenticate staff and enforce role-based access (e.g. only Admins can approve, reject, or delete a collection batch)
- To maintain an audit trail of who took which action, for accountability and dispute resolution

We do not use this data for advertising, and we do not sell or rent it to third parties.

## How data is stored and protected

- All data is stored in a private database we operate; it is not publicly accessible
- Passwords are hashed with bcrypt; they are never stored or logged in plain text
- Staff session tokens on the App are stored in the device's OS-level secure keystore
- Network requests from the App to our servers should occur only over HTTPS
- Access to customer and financial data within the system is restricted by staff role

## Data sharing

We do not share customer or staff data with third parties, except:
- Where required by law, regulation, or a valid legal request
- With service providers who host our infrastructure, under confidentiality obligations, and only as needed to operate the service

## Data retention

We retain customer and transaction records for as long as needed to service the associated installment plan and to meet our bookkeeping/legal recordkeeping obligations, and staff account records for as long as the staff member's account is active plus a reasonable period afterward for audit purposes.

## Your rights

Customers whose information is held in this system, or staff with an account, may request access to, correction of, or deletion of their personal data by contacting us at **[CONTACT EMAIL]**. We will respond within a reasonable time, subject to any records we're legally required to retain.

## Children's privacy

The App is a business tool for our staff and is not directed at children. We do not knowingly collect information from children.

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above.

## Contact us

Questions about this policy or your data can be sent to **[CONTACT EMAIL]**.

---

### Before this can be submitted to Google Play

1. Fill in `[COMPANY / OWNER LEGAL NAME]`, `[CONTACT EMAIL]`, and `[DATE]` above.
2. Have it reviewed by whoever handles legal/compliance for the business.
3. Host it at a public URL (e.g. as a page on your company site).
4. Paste that URL into the Play Console's privacy policy field, and use the data categories listed above ("Personal info", "Financial info") to fill out the Data Safety form.
