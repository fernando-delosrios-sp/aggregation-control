# SailPoint Non-Employee Risk Management+

## Changelog

-   0.1.7 (2025-06-24):
    -   More bug fixes
    -   Added password change support for portal users
-   0.1.6 (2025-06-03):
    -   More bug fixes
    -   Added Status mapping between profiles and users
-   0.1.5 (2025-04-02):
    -   Countless bug fixes
    -   Added account create template
-   0.1.3 (2025-01-13):
    -   Schema discovery and user management fixes
-   0.1.2 (2025-01-10):
    -   Minor fixes
-   0.1.1 (2024-12-27):
    -   Documentation
    -   Minor fixes
-   0.1.0 (2024-12-24):
    -   Initial draft

## Introduction

This is an SaaS connector for SailPoint Non-Employee Risk Management. It was built to address most common integration challenges based on my experience. The most significant features of this connector are:

-   Full provisioning support for profiles, users and portal users.
-   Seamless combined profile/user management (i.e. manage a People profile and its associated user as a single account).
-   Run custom NERM workflows on account operations (e.g. run Terminate Assignment workflow upon disable operation).
-   Trigger workflow executions on ephemeral access requests (i.e. request access profile with workflow entitlement that runs on provisioning, but it does not assign the entitlement).
-   Manage user roles as entitlements.
-   Manage associated profiles as entitlements (e.g. add/remove locations to an assignment as ISC entitlements).
-   Profile attribute traversing (e.g. read all job titles of a People profile's assignments).
-   Dynamic multi-valued attribute management (i.e. the connector concatenates values if multiple are found and the attribute is not multi-valued).
-   Optional push mode (i.e. push search results to NERM and persist them as profiles, with the ability of keeping nesting relationships like roles to entitlements).

## Configuration

### Overview

The connector uses both ISC and NERM APIs to perform its operations so you will need to provide admin credentials. Then, you need to decide how the connector will operate since it can manage any profile, user or portal user as accounts, or a combination of them. In most cases, the connector will manage People profiles and users via entitlements, or Assignment profiles, with or without an additional supporting People source. Bear in mind one could create a People source and still fetch all different job titles or departments from associated Assignments, all from a single source. Your setup will ultimately depend on your particular needs.

From an entitlement perspective, you will be able to manage user roles, workflow executions or associated profiles. Since we are managing very different concepts for each, consider you cannot expect to assign a role to a profile with no associated user to it, or run a workflow on a user account.

From an account attribute perspective, note the connector traverses linked profiles through their attributes based on your account schema. When defining an account attribute like _person_assignments.assignment_department_, that attribute will contain all the department values of each one of the existing assignments. Traversing supports through multiple hops so it would work to fetch values from indirectly associated profiles. Note that when multiple values are found, the connector flattens the values into a string like _[a] [b] [c]_ if the schema attribute is not multivalued. If it is multivalued, it will be presented as is.

Finally, the connector supports push mode. Push mode is totally optional and it runs either on account aggregation when enabled or when called by its custom operation. Pushing contents requires careful mapping and it may require custom profile types and attributes on NERM. It is an operation that works separately from anything else but it can be associated to account aggregation for convenient scheduling.

### ISC connection details

Provide the connection details for a PAT with read/write access. The connector mainly runs search operations and creates source entitlement schemas. Scope it out at your own convenience.

### NERM connection details

Provide API url and access token for NERM. You can also change the default admin username to change who runs workflows in some operations.

### Configuration

**Accounts**

You must select the account type you want to manage. If selecting profile, you need to provide profile name to work with and optionally the login attribute in the event you want to manage profiles combined with users.

![Accounts configuration](assets/images/accounts.jpg)

Account operations on profiles also support optional workflow executions. You need to register the workflow with the account operation you want to trigger it. The name is for reference only but the ID needs to match NERM's workflow ID. The workflow needs a requester. Possible values are:

-   **Admin**: user determined by source configuration.
-   **Sponsor**: user determined by profile's sponsor_user_id attribute.
-   **User**: user determined by profile's user_id attribute.
-   **Approver**: user determined by profile's approver_user_id attribute.

Finally, you can determine whether the operation should wait for the workflow to finish before reading the results back. If the workflow is interactive, you must not select this option. Otherwise, it depends on how long you think the workflow may take to finish.

![Account workflows configuration](assets/images/account_workflows.jpg)

**Entitlements configuration**

-   **Workflows**: similar to previous operation configuration, here you can define workflows that will be run on entitlement assignment. Please note these entitlements are not to be assigned as a persistent attribute. These entitlements must be wrapped into access profiles and requested since a workflow is not something you would assign to a profile. This is just a convenient way to trigger a workflow on demand.

![Workflow entitlements](assets/images/entitlement_workflow.jpg)

-   **Profiles**: again, similar concept as before. This configuration will determine the profile type name to read from and the ISC account attribute to store assignments. You need to add the NERM attributes to collect metadata from for your entitlements. Ultimately, you need to discover the account schema to update it based on these settings and make sure the account attribute points to the dedicated entitlement schema.

![Profile entitlements](assets/images/entitlement_profile.jpg)

### Push Mode Configuration

Push mode is an optional feature that helps syncing ISC objects with NERM profiles. These objects in question are roles, access profiles, entitlements and identities. It can be run alongside with account aggregation or invoking _std:push:contents_ custom operation.

![Push mode](assets/images/push_mode.jpg)

There are multiple configuration settings to properly configure push mode. Each profile mapping can be independent of each other or keep the existing relationships like identity to role or role to entitlement. These relationships must be set on the children element type.

-   **Search index**: search index to use to pull contents from.
-   **Search**: search string as you would use on the search UI.
-   **ID attribute**: NERM attribute name to store ISC object ID to avoid object duplication.
-   **Profile type name**: NERM profile type name to map to.
-   **Attribute mapping**: NERM to ISC attribute mapping. Note an ISC attribute like _source.name_ effectively fetches the name element from the source object.
-   **Nest elements?**: check if this is a child element of a previously defined mapping.
-   **Only sync nested elements**: only push those elements that can be found associated to a parent object.
-   **Parent index search**: parent search index. Must have been defined before as a mapping.

![Push mode profile configuration](assets/images/push_mode_profile.jpg)
