/**
 * Makes the Depth Cache sample's WorldLabel prefab work as a free-floating label.
 *
 * The prefab was built for labels placed in front of the camera by the sample: its root sits at x = -100, the
 * fixed-size frame ("labelTextExtents") is a sibling of the text, and a Look At component turns only the text.
 * Once we place and billboard labels ourselves, the frame drifts in front of the text and never matches its width.
 * So: centre the root, hide the frame, and let the Text draw its own rounded backing sized to the text.
 */
import {WorldLabel} from "../../Scripts/WorldLabel"

export function tidyLabel(inner: SceneObject, text: string): Text | null {
  inner.getTransform().setLocalPosition(vec3.zero())
  hideByName(inner, "labelTextExtents")
  const wl = inner.getComponent(WorldLabel.getTypeName()) as WorldLabel
  if (!wl || !wl.textComp) return null
  const t = wl.textComp
  t.text = text
  try {
    t.textFill.color = new vec4(1, 1, 1, 1)
    // Text-sized backing: on the see-through display dark reads as transparent, so this mainly helps in Preview
    // and over bright scenery. The outline keeps edges crisp either way.
    t.backgroundSettings.enabled = true
    t.backgroundSettings.fill.color = new vec4(0.03, 0.06, 0.12, 0.55)
    t.backgroundSettings.cornerRadius = 0.6
    t.backgroundSettings.margins = Rect.create(-1.2, 1.2, -0.6, 0.6)
    t.outlineSettings.enabled = true
    t.outlineSettings.size = 0.08
    t.outlineSettings.fill.color = new vec4(0, 0, 0, 1)
  } catch (e) {
    // Older Text without these settings: plain text is fine.
  }
  return t
}

/**
 * Turns a tidied label into a bold building sign (the real-world nametag title).
 * Spectacles' display is additive, so black outlines vanish on device: the weight comes from an outline in the fill's
 * own colour (faux bold), and the dark shadow and plate only help in Preview and against bright sky.
 */
export function styleAsSign(t: Text, rgba: number[], font?: Font) {
  t.text = (t.text || "").toUpperCase()
  try {
    if (font) t.font = font
    t.letterSpacing = 1.5
    t.textFill.color = new vec4(rgba[0], rgba[1], rgba[2], rgba[3])
    t.outlineSettings.enabled = true
    t.outlineSettings.size = 0.14
    t.outlineSettings.fill.color = new vec4(rgba[0], rgba[1], rgba[2], rgba[3])
    t.dropshadowSettings.enabled = true
    t.dropshadowSettings.offset = new vec2(0.08, -0.08)
    t.dropshadowSettings.fill.color = new vec4(0, 0, 0, 0.85)
    t.backgroundSettings.enabled = true
    t.backgroundSettings.fill.color = new vec4(0.02, 0.04, 0.09, 0.7)
    t.backgroundSettings.cornerRadius = 0.8
    t.backgroundSettings.margins = Rect.create(-1.8, 1.8, -0.9, 0.9)
  } catch (e) {
    // Older Text without these settings: the size increase alone still helps.
  }
}

function hideByName(o: SceneObject, name: string) {
  for (let i = 0; i < o.getChildrenCount(); i++) {
    const c = o.getChild(i)
    if (c.name === name) c.enabled = false
    else hideByName(c, name)
  }
}
