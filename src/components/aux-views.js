// Links the desktop top/side panels (ViewPanels.vue) to the scene owned by Viewport.vue.
// Panels register their canvases here; Viewport renders into them after each frame.
export const auxViews = {
	/** view name ('top' | 'side') → 2D canvas */
	targets: new Map(),
	/** Set by Viewport: re-render everything, e.g. after a panel resizes. */
	request: null,
}
