# ZRMconnector
Zotero / ReMarkable connector

## Principles

The ZRMconnector is used to connect Zotero and Remarkable tag data. As a lot of science reader use Zotero tags to remember about metadata (article read, left to read, currently reading, etc.), this "background" server system assists the reader in displaying those articles in specific folders according to their tags.

### example

A PhD student wanting to easly access its reading papers on its ReMarkable can use the ZRMconnector this way:

 - tag your article with relevant tag names (e.g. toread, reading, done)
 - create a **Connector** in which 

## Demo video

[![](https://img.youtube.com/vi/LV1IQmUHl_A/0.jpg)](https://www.youtube.com/watch?v=LV1IQmUHl_A)

## Install

Install using 
```bash
git clone git@github.com:hugodecasta/ZRMconnector.git
```

Get into the repository and setup the npm packages
```bash
cd ZRMconnector
npm i
```

## Setup

Setting up the ZRMc server is quite simple and quick:
 - setup connectors
 - launch the server
 - provide asked credential
 - leave it alone ...

### Connectors

A `connectors.json` file is required in order for the ZRMc server to deliver its service.

Create the `connectors.json` file at the root of the repository.

Inside this file, one need to add each connector as a property as follows:

```json
{
    "connector_1": {},
    "phd_connector": {},
    "my_company_conn": {}
}
```

(for the `{}` objects, see the connector syntax below)

### Connector

Here is the required connector syntax
```json
{
    "remarkable_dir": "/RM_Directory/to/the/articles",
    "remarkable_archive_dir": "trash or whatever sub dir of 'remarkable_dir'",
    "zotero_path": [
        {
            "type": "group",
            "name": "My_Company_group_name"
        },
    ],
    "tags": {
        "me - toread": "to read",
        "me - reading": "reading",
        "me - done": "done"
    }
}
```

the `remarkable_dir` property indicates the main ReMarkable directory in which the connector whill store and look for content. This directory **MUST** be existing when the server is initiated

the `remarkable_archive_dir` property indicated the relative to `remarkable_dir` directory in which to archive the "deleted" or un-taged articles (the value `trash` indicates to delete those articles)

the `zotero_path` property indicates the main library monitored by the system:
 - `{ type: "group", name: "my_group" }` indicates a group
 - `{ type: "collection", name: "phd" }` indicates a user collection

the `tags` property indicated the tags and directory names associated respectivly with the Zotero account and the ReMarkable account. In this example, each article tagged `me - toread` will end up in the `/RM_Directory/to/the/articles/to read` folder in the ReMarkable

## Launch

Launch the ZRMc server using 
```bash
node .
```

### Credentials

Once stated, the ZRMc server will ask for the following credentials (maybe not in this order):
 - **ReMarkable One Time Code** : found in the [My-ReMarkable](https://my.remarkable.com/list/desktop) panel (click on "Connect new desktop" to generate the code)
 - **Zotero API key** : found in the [Feeds/API](https://www.zotero.org/settings/keys) zotero panel (click "Create new private key" to create your API key)
 - **Zotero user_id** : found in the [Feeds/API](https://www.zotero.org/settings/keys) "Your userID for use in API calls is: XXXXXXX"

## Usage

The ZRMc server will download all tag-related article into the ReMarkable according to the connector settings.

Never put files in the tagged directories (might fail the ZRMc server)

You can change the tags (will move the related ReMarkable articles automatically)

You can move the articles from tagged-directory to tagged-directory in the ReMarkable (will retag or untag the related articles in Zotero automatically)

## Limitations

The ReMarkable cloud sync systems is not stable at this moment. Consequently, every change in the cloud initiated by the system will take effect on the ReMarkable tablet only if the tablet is opened and in realtime syncing mode. All changes applyed in the cloud while the tablet is sleeping or offline will not be synced once the tablet is awake again thus creating data inconsistency between the tablet and the cloud.