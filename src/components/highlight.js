// Which readout card is hovered ('spill' | 'cropSpill' | 'floor' | 'coverage' | 'headroom' |
// 'footprint' | null). Viewport draws that card's dimensions over the render.
import { ref } from 'vue'

export const highlight = ref(null)
