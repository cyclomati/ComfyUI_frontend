# Pixal3D + TRELLIS.2 model preview

## Status and boundary

This route is an interactive design preview at
`/models-v2/pixal3d-trellis2`. It demonstrates the workflow's exposed image
input, payload, result receipt, and orbitable GLB output. It does not submit a
real generation job or establish production pricing, authentication, storage,
analytics, or error handling.

## Sources

1. Existing `/models-v2/[slug]` preview shell and interactions.
2. Existing website buttons, badges, cards, tokens, navigation, and footer.
3. The supplied `3d_pixal3d_trellis2_image_to_model.json` workflow.
4. Live Comfy Design Standards for hover feedback, affordances, and click
   targets.

## Provenance

| Visible pattern                                              | Classification            | Source                                                             |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------ |
| Page shell, tabs, cards, auth preview, API and cost sections | Exact reuse               | Existing model-v2 preview                                          |
| Image picker, drag target, attachment preview                | Approved variant          | Existing reference-image input                                     |
| Interactive GLB canvas                                       | Feature-local composition | Three.js and the product's established 3D-viewer interaction model |
| Result JSON and download action                              | Approved variant          | Existing result card                                               |

## Workflow mapping

- Exposed input: one PNG, JPG, or WebP image.
- Output: textured GLB model.
- Internal workflow details remain on the full graph and are not duplicated as
  playground controls.
- The supplied workflow contains 66 nodes, including `LoadImage`,
  `Preview3DAdvanced`, and `Save3DAdvanced`.

## Media and data

- Example imagery comes from Comfy's `workflow_templates` repository.
- The orbitable model is a procedural placeholder mesh exported to GLB in the
  browser. It proves viewer and download behavior without claiming to be a real
  inference result.
- Uploaded images remain in the browser and are represented by filename in the
  preview payload. They are not transmitted.

## Exclusions

- Real workflow execution and upload transport.
- Production credit calculation.
- PLY, OBJ, FBX, STL, USDZ, animation, material, or environment controls.
- Persistence across reloads.

## Acceptance gates

- The route requires an image before the preview run can proceed.
- The uploaded filename appears in the JSON input payload.
- Prompt, video duration, aspect ratio, resolution, and seed controls are absent.
- The result is an orbitable, zoomable GLB viewer with a GLB download action.
- Upload controls have full-surface pointer and keyboard targets with visible
  hover and focus feedback.
- The route remains `noindex` and behaves at desktop and narrow widths.
