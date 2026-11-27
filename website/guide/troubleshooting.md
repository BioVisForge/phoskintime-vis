# Troubleshooting

| What you see | Why, and what to do |
|---|---|
| "No manifest.json found" | The file or folder is not a run bundle. Choose the `<run>.pkt` folder itself or its zip. |
| The bundle is refused because of its schema version | It was written by a newer format (2.0 or later). Use a newer viewer. |
| **sha256 mismatch** or **files missing** | A file differs from the manifest, for example after editing or an incomplete copy. The inspector lists the files. Get a fresh copy; do not rely on figures from a mismatching bundle. |
| A panel says **Not available** | The bundle lacks the table or column; the panel quotes the reason from the manifest if there is one. |
| "Labels do not fit … mm" | Choose a fix; see [Export](export.md#when-labels-do-not-fit). |
| PNG export is refused as too large | The requested size and dpi exceed what the browser can draw. Lower one of them; the viewer does not silently reduce it. |
| TeX runs out of memory | Compile with LuaLaTeX, or tick **Downsample for TeX** and export again. |
| Settings or theme are not remembered | The browser blocks storage for local files or private windows. |
| A copied link opens an empty viewer | Links carry the view, not the data. Open the bundle first, then follow the link in the same tab. |

Still stuck? [Open an issue](https://github.com/BioVisForge/phoskintime-vis/issues) and attach a
synthetic bundle if you can. For security problems use
[private reporting](../development/security.md).
