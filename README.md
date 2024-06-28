# Excel Mapper Plugin

## Overview

The Excel Mapper Plugin is a powerful tool that allows you to seamlessly import and export data between kintone and Excel spreadsheets. With this plugin, you can easily map fields from your kintone app to corresponding columns in an Excel file, making data management and synchronization a breeze. This customization works on both desktop and mobile.

## Installation

To install the Auto Assign Plugin, follow these steps:

1. Download this source code
2. Run this command to install all dependencies.

   ```
   npm i
   ```

3. Run this command within the root directory of extracted .zip to upload directly the plugin.zip to your kintone domain.

   ```
   npm start
   ```

or

1. Open your kintone application and navigate to the "Plugin Management" section.
2. Click on the "Upload Plugin" button and select the downloaded plugin package.
3. Select the plugin.zip from the dist folder on this root after you run build.
4. Once the plugin is uploaded, click on the "Install" button to activate it.

Install plugin in your desired kintone app.

## Configuration

After installing the Excel Mapper Plugin, you need to configure it to define the assignment rules. Here's how you can do it:

1. Open your kintone application and navigate to the "Plugin Management" section.
2. Find the Excel Mapper Plugin and click on the "Settings" button.
3. In the settings page, you will see a list of available config for mapping.
4. Setup the fields needed for source and destination apps.
5. After selecting the destination app, the default fields will be listed.
6. Click on the "Add Mapping" button to create a new mapping or "Remove Mapping" as desired.
7. Specify the mapping reference from excel for each mapping.
8. Check the split for each mapping you want to be split and specify the Start and End Line.
9. Save the rule and repeat the process to add more mapping if needed.

## Usage

Once the Auto Assign Plugin is configured, it will automatically post the data from the excel files into kintone records in your configured destination apps. Here's how it works:

1. Open your source app where you installed the plugin.
2. Add new record.
3. Upload the excel files in your predefined attachment field.
4. Save the record.
5. Check if the records posted to destination apps and mapped to the fields you have configured.

That's it! You have successfully installed and configured the Excel Mapper Plugin. Enjoy seamless data synchronization between kintone and Excel!

## Kintone Apps Template

You can use these files to test the auto assign feature. Note that you still need to configure the plugin in settings page.

Inside the kintone-template-apps:

1. Purchase Order - as source/impacted app
2. Team Management - as references

## Troubleshooting

If you encounter any issues with the Auto Assign Plugin, here are some common troubleshooting steps:

1. Check the plugin settings to ensure that the mappings are correctly configured.
2. Make sure that the plugin is properly installed and activated.
3. If the issue persists, contact the plugin support team for further assistance.

That's it! You now have a comprehensive guide on how to use the Auto Assign Plugin. Happy automating!
