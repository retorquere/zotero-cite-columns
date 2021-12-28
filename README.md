Cite Columns
=================

Install by downloading the [latest version](https://github.com/retorquere/zotero-cite-columns/releases/latest)

Add CSL-rendered columns from items.

# Usage

You will need to create a CSL style with some special characteristics for this extension to work. You can use the [visual CSL editor](https://editor.citationstyles.org/visualEditor/) to create it; a base style can be found [here](https://raw.githubusercontent.com/retorquere/zotero-cite-columns/master/zotero-cite-columns.csl).

This style must have:

* `/style/info/id` must be `http://www.zotero.org/styles/zotero-cite-columns`
* `/style/citation/layout` must have a single child element, which must be a `group`.
* `/style/citation/layout/group` must have only `text` children of type `macro`

You must copy this style to the zotero data directory (see Preferences - Advanced - Files and Folders for its location) and must be named `zotero-cite-columns.csl`.

The names of the macros called from the group will become the columns in the middle pane of Zotero. You can use underscores (`_`) in the macro names where you want to have spaces.

# Support - read carefully

My time is extremely limited for a number of very great reasons
(you shall have to trust me on this). Because of this, I cannot
accept bug reports or support requests on anything but the latest
version. If you submit an issue report, please include the version
that you are on. By the time I get to your issue, the latest version
might have bumped up already, and you will have to upgrade (you
might have auto-upgraded already however) and re-verify that your
issue still exists.  Apologies for the inconvenience, but such are
the breaks.

