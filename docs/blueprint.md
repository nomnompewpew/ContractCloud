# **App Name**: Iliad Orders

## Core Features:

- Secure Login: Enable sales specialists to log in securely using their iliadmg.com Google Workspace accounts via Google OAuth.
- Tabbed Navigation: Provide a user-friendly interface with tabs for Order Entry, Pending Verification, Search, and Recents.
- Order Entry Form: Allow users to upload PDF files, input client details, order dates, salespersons, station call letters, and order types.
- Automated PDF Storage: Automatically store PDFs in Firebase Storage under Sales Orders/{Client}/{Year} or TWF Sales Orders/{Client}/{Year} for Twin Falls locations.
- Order Verification Table: Display unverified orders in a table, allowing users to preview PDFs and verify orders with a click.
- Order Number Extraction: Implement an AI tool to suggest order numbers by extracting it from the filename of uploaded PDF files. Regex pattern to find the first number in the PDF filename is used.
- Fuzzy Search: Enable fuzzy searching of orders by Client, Order Number, or Station Call Letters, with results displaying PDF links.

## Style Guidelines:

- Use Iliad Media Group's primary blue (#003057) to convey trust and reliability.
- Light gray (#F0F2F5), nearly white, for a clean, uncluttered feel.
- Use Iliad Media Group's gold/yellow (#F2B705) for highlighting key actions and notifications.
- Use 'Roboto', matching Iliad Media Group's site, for consistency and readability.
- Use simple, professional icons from a library like Material Icons to represent actions and statuses.
- Maintain a clean, consistent layout with clear separation between sections and a persistent top navigation bar.
- Use subtle animations, such as fading and sliding, to provide feedback on user interactions.