# Changelog

## v0.1.3 Beta - Performance Refactor & Architectural Overhaul

This version introduces a critical architectural change to address major performance bottlenecks, moving from a "fetch-all" data loading strategy to an efficient, on-demand, server-side pagination model. This resolves application slowdowns and crashes, ensuring the app remains fast and scalable as the dataset grows.

### Features & Enhancements:

-   **Server-Side Pagination:** The "Orders" tab now fetches data in manageable pages (batches of 50) instead of loading all contracts from the past year at once. This dramatically improves initial load time and reduces memory consumption.
-   **On-Demand Loading:** A "Load More" button allows users to progressively load older contracts as needed.
-   **Optimized Data Flow:** Refactored component data flow to eliminate unnecessary re-renders and improve UI stability, resolving a React lifecycle crash.
-   **Improved Filtering:** Search and filter logic now operates on the currently displayed data, providing a more intuitive user experience.
-   **Unified Dev & Prod Auth:** Enabled the standard OAuth flow in the development environment by authorizing the Cloud Workstation URL, removing the need for stub users and creating a more consistent testing experience.

### Bug Fixes:

-   Fixed a critical React error ("Cannot update a component while rendering a different component") caused by an improper state update from a child component.
-   Corrected a Firestore query error ("limit is not a function") in the new pagination logic, ensuring paginated fetching works correctly.

## v0.1.2 Beta - Unified UI and Automation

This version focuses on significant workflow automation, UI cleanup, and the introduction of key data fields (Stations and Market) to improve data accuracy and organization.

### Features & Enhancements:

-   **Automated Contract Processing:** The contract entry process is now fully automated. Upon file upload, the system automatically merges all documents and scans the result to pre-fill the form, transforming a multi-click process into a single action.
-   **Station & Market Tracking:**
    -   The AI now extracts all station call letters mentioned in a contract.
    -   Added a required "Market" dropdown (Boise/Twin Falls).
    -   Added a "Stations" checkbox section, which is automatically populated by the AI scan.
    -   The UI now conditionally displays only the relevant stations for the selected market, reducing clutter.
-   **Improved Google Drive Organization:** Contracts are now automatically filed into the correct `Market/Year/Client` folder structure in Google Drive.
-   **Enhanced Order Management:** The "Orders" tab now displays, filters, and allows bulk editing for the new "Market" and "Stations" fields.
-   **Streamlined UI:**
    -   Removed redundant buttons from the contract entry form.
    -   The merged PDF preview is now optional and opens a secure Google Drive link.
    -   Toast notifications have been moved to the top-center of the screen to prevent them from blocking UI elements.

### Bug Fixes:

-   Resolved a critical bug where the PDF merger would fail to process any files.
-   Fixed a recurring crash related to the client selection combobox.
-   Corrected a Next.js hydration error caused by the toast notification component.

## v0.1.1 Beta - Ready for Presentation

This version is configured for demonstration purposes. It features a fully functional front-end with an in-memory database, allowing for a complete demonstration of the user workflow without requiring live database credentials.

### Features:

-   **Order Entry:** Users can fill out an order form.
-   **AI-Powered PDF Scanning:** Uploading a PDF automatically extracts and fills key form fields using Genkit and the Gemini API.
-   **Google Drive Integration:**
    -   On submission, order PDFs are uploaded to a "Pending" folder in Google Drive.
    -   On verification, PDFs are renamed and moved to the appropriate `Client/Year` folder structure.
-   **In-Memory Database:** All orders are stored in a temporary state on the page, allowing for adding, verifying, and searching within a single session.
-   **Full-Text Search:** Users can search and filter orders across all fields in the "Orders" tab.
-   **Bulk Actions:** Users can perform bulk edits and deletes on filtered orders.

### Known Limitations (for Demo):

-   The application uses a temporary, in-memory database. All data will be lost upon page refresh.
-   User authentication is not implemented; user-specific actions like "enteredBy" and "verifiedBy" use placeholder data.
