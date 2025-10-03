# Aggregation Control Connector for SailPoint

## Changelog

-   0.0.1 (Unreleased):
    -   Initial release with support for aggregation control and source management.

## Introduction

This project provides a connector for SailPoint Identity Security Cloud (ISC) that enables advanced aggregation control and source management. The connector is designed to help administrators manage how and when account data is aggregated from various sources, with configurable thresholds and attribute-based controls.

Key features include:

-   Aggregation control based on percentage change thresholds.
-   Support for multiple sources, each with independent configuration.
-   Option to compare all attributes or only specific ones for change detection.
-   Flexible configuration via the ISC connector UI.
-   **Per-source aggregation status accounts:** For each configured source, the connector creates a dedicated account that represents the results of the latest aggregation attempt. This account includes details such as the aggregation status, the number of detected changes, the configured threshold, and a message describing the outcome. This makes it easy to track aggregation results and status for each source directly within ISC.

## Configuration

### ISC Connection Details

To use the connector, you must provide the following ISC connection details:

-   **Identity Security Cloud API URL** (`isc_baseurl`): The base URL for your ISC tenant.
-   **Personal Access Token ID** (`isc_clientId`): The client ID for your ISC PAT.
-   **Personal Access Token Secret** (`isc_clientSecret`): The secret for your ISC PAT.

These credentials must have sufficient permissions to read and manage sources.

### Source Management Configuration

The connector allows you to define one or more sources to manage. Each source can be configured with:

-   **Source name** (`name`): A descriptive name for the source.
-   **Percentage change** (`percentage`): The maximum allowed percentage of changes before aggregation is blocked.
-   **Compare all attributes** (`all`): If enabled, all attributes are compared for changes. If disabled, you must specify which attributes to compare.
-   **Attributes** (`attributes`): (Optional) A list of attribute names to include in the snapshot when `all` is set to false.

You can add, edit, copy, or remove source configurations directly from the connector UI.

For each source you configure, the connector will create a corresponding account in ISC that summarizes the latest aggregation result for that source.

Example source configuration:
