// Save or copy a rendered view as PNG.

export function canvasToBlob(canvas) {
	return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function downloadBlob(blob, filename) {
	if (!blob) return
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

export async function copyBlob(blob) {
	if (!blob || !navigator.clipboard?.write) return
	await navigator.clipboard
		.write([new ClipboardItem({ 'image/png': blob })])
		.catch((err) => console.warn('POSE: copy image failed', err))
}

/** File name like pose-camera-2026-09-23-1542.png */
export function imageName(view) {
	const d = new Date()
	const p = (n) => String(n).padStart(2, '0')
	return `pose-${view}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`
}
