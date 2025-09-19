# ContractCloud

ContractCloud is an internal tool designed to streamline and automate the contract management workflow for the Iliad Media Group sales team. It leverages AI to reduce manual data entry, integrates deeply with Google Drive for organized file storage, and provides a robust interface for managing and searching sales contracts.

## Core Features

-   **AI-Powered Contract Scanning:** Users can upload multiple source files (PDF, JPG, PNG). The application automatically merges them into a single PDF and uses Genkit with the Gemini API to scan the document, pre-filling form fields like Client, Agency, and Stations.
-   **Automated Google Drive Filing:** Upon submission, contracts are automatically named and filed into a structured `Market/Year/Client` folder system within Google Drive, ensuring consistency and eliminating manual organization.
-   **Paginated Order Management:** The "Orders" tab provides a comprehensive view of all contracts. To ensure high performance, it loads orders in pages, allowing users to efficiently browse or search through thousands of records without slowdowns.
-   **In-Place & Bulk Editing:** Users can perform quick, in-line edits on any order directly from the main table or use bulk-editing tools to update multiple filtered orders at once.
-   **Revision & Append Workflow:** Existing contracts can be easily revised. Users can append new documents, which are merged with the original PDF, and update the contract's status (e.g., to "Revision" or "Cancellation").
-   **Data Correction Tools:** A secure admin dashboard provides powerful tools for correcting data inconsistencies in bulk, such as fixing client names or entry dates across hundreds of records using AI-assisted suggestions.
-   **Smart Importer:** An administrative tool for bulk-importing legacy contracts from an existing Google Drive folder structure into the database.

## Technical Architecture

-   **Framework:** Next.js (App Router) with React Server Components.
-   **Styling:** Tailwind CSS with shadcn/ui components.
-   **Generative AI:** Google's Genkit for defining AI flows that interact with the Gemini family of models.
-   **Database:** Firestore for storing all contract metadata.
-   **File Storage:** Google Drive for storing the final PDF contracts.
-   **Authentication:**
    -   **User Auth:** Client-side Firebase Authentication (OAuth with Google), restricted to the `@iliadmg.com` domain.
    -   **Service Auth:** Server-side Google Cloud Service Accounts with user impersonation (JWT) for secure access to Google Drive and Google Workspace APIs.
-   **Deployment:** Firebase App Hosting.
