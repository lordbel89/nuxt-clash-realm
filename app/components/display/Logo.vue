<script setup lang="ts">
withDefaults(defineProps<{
  /** mono e outline prendono il colore del testo: si colorano con le classi text-* */
  variant?: 'color' | 'mono' | 'outline' | 'mono-xl';
  /** Spessore delle linee di outline, in unità del viewBox (alto 895) */
  strokeWidth?: number;
}>(), { variant: 'color', strokeWidth: 14 });
</script>

<template>
  <!-- L'SVG fa da maschera su uno sfondo bg-current: con <img> il CSS non arriverebbe ai fill -->
  <span
    v-if="variant === 'mono'"
    aria-hidden="true"
    class="block aspect-925/690 bg-current mask-[url(/assets/logo-monocromatico.svg)] mask-contain mask-center mask-no-repeat"
  />
  <!-- L'SVG fa da maschera su uno sfondo bg-current: con <img> il CSS non arriverebbe ai fill -->
  <span
    v-else-if="variant === 'mono-xl'"
    aria-hidden="true"
    class="block aspect-925/690 bg-current mask-[url(/assets/logo-monocromatico-spazio-2xl.svg)] mask-contain mask-center mask-no-repeat"
  />
  <!-- Inline e non maschera, perché lo spessore delle linee sia una prop -->
  <svg
    v-else-if="variant === 'outline'"
    aria-hidden="true"
    viewBox="0 0 1200 895"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="square"
    class="block"
  >
    <path d="m 225.277,406.586 -86.122,-194.908 161.819,76.15 1.813,-167.711 166.805,121.931 130.996,-206.693 131.449,206.693 164.538,-121.931 2.266,167.711 163.632,-77.057 -88.388,192.188 C 883.43,465.512 352.194,472.764 225.277,406.586 Z" />
    <path d="m 168.26923,340.70512 21.15385,43.26924 c -14.10257,9.93589 -34.68487,11.22986 -34.29487,33.01282 22.00918,40.60849 220.78195,68.28166 426.29397,70.18963 219.46654,2.03753 459.16912,-30.35706 465.05222,-72.75373 2.8846,-15.70513 -34.9359,-31.41026 -34.9359,-31.41026 l 18.2692,-42.30769 c 103.0166,23.94454 141.0513,64.35995 136.5384,82.37179 C 1143.8846,504.5503 853.80578,547.00604 593.58974,546.79488 333.37371,546.58371 59.918507,498.64945 34.615384,427.5641 29.825082,376.35055 168.26923,340.70512 168.26923,340.70512 Z" />
    <path d="m 40.384615,498.07692 c 0,0 56.423818,44.43448 233.974365,65.38461 3.19156,15.18091 29.32692,280.92948 29.32692,280.92948 0,0 -151.44616,-15.90686 -219.070512,-75.80129 -6.726916,-22.07391 -44.230773,-270.5128 -44.230773,-270.5128 z" />
    <path d="m 1162.1798,498.07692 c 0,0 -56.4239,44.43448 -233.97441,65.38461 -3.19156,15.18091 -29.32692,280.92948 -29.32692,280.92948 0,0 151.44613,-15.90686 219.07053,-75.80129 6.7269,-22.07391 44.2308,-270.5128 44.2308,-270.5128 z" />
    <path d="m 317.94871,567.94872 c 98.28279,18.0626 449.72597,19.21918 569.2308,-0.64103 -6.13621,65.3962 -33.97441,282.69229 -33.97441,282.69229 0,0 -76.61153,13.25744 -185.25638,12.17954 0.32951,-73.51379 15.493,-160.48363 -65.38462,-163.46157 -80.87762,-2.97794 -69.93562,85.74608 -67.30769,164.74362 -46.73104,1.43344 -187.82051,-13.4616 -187.82051,-13.4616 0,0 -21.35972,-211.01129 -29.48719,-282.05125 z" />
  </svg>
  <img
    v-else
    src="/assets/logo-colore.svg"
    alt=""
    width="925"
    height="690"
  >
</template>
