export function setupDropZone(onFile: (file: File) => void): void {
  const zone = document.getElementById('drop-zone')!

  document.addEventListener('dragover', (e) => {
    e.preventDefault()
    zone.classList.remove('hidden', 'pointer-events-none')
    zone.classList.add('flex', 'pointer-events-auto')
  })

  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || (e.relatedTarget as Node).ownerDocument !== document) {
      zone.classList.add('hidden', 'pointer-events-none')
      zone.classList.remove('flex', 'pointer-events-auto')
    }
  })

  zone.addEventListener('dragover', (e) => e.preventDefault())

  zone.addEventListener('drop', (e) => {
    e.preventDefault()
    zone.classList.add('hidden', 'pointer-events-none')
    zone.classList.remove('flex', 'pointer-events-auto')

    const files = e.dataTransfer?.files
    if (files?.[0]) {
      onFile(files[0])
    }
  })

  zone.innerHTML = `
    <div class="m-auto flex items-center justify-center w-96 h-48 rounded-xl border-2 border-dashed border-blue-400 bg-gray-900/80 backdrop-blur-sm">
      <p class="text-blue-300 text-lg font-medium">Drop XML or GPX file here</p>
    </div>
  `
}
