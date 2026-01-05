<template>
  <div v-if="isActive">
    <li class="headline">Grimoire</li>
    <li @click="$emit('toggle-modal', 'journal')">
      Journal
      <em>[W]</em>
    </li>
    <li @click="$emit('toggle-grimoire')" v-if="playersCount">
      <template v-if="!isPublic">Hide</template>
      <template v-if="isPublic">Show</template>
      <em>[G]</em>
    </li>
    <li @click="$emit('toggle-night')" v-if="!isSpectator">
      <template v-if="!isNight">Switch to Night</template>
      <template v-if="isNight">Switch to Day</template>
      <em>[S]</em>
    </li>
    <li
      @click="$emit('toggle-night-order')"
      v-if="playersCount && !isSpectator"
    >
      Night Order
      <em>
        <font-awesome-icon
          :icon="['fas', isNightOrder ? 'check-square' : 'square']"
        />
      </em>
    </li>
    <li @click="$emit('toggle-modal', 'timer')" v-if="!isSpectator">
      Timer
      <em>[T]</em>
    </li>
    <li v-if="playersCount">
      Zoom
      <em>
        <font-awesome-icon
          @click="$emit('set-zoom', zoom - 1)"
          icon="search-minus"
        />
        {{ Math.round(100 + zoom * 10) }}%
        <font-awesome-icon
          @click="$emit('set-zoom', zoom + 1)"
          icon="search-plus"
        />
      </em>
    </li>
    <li @click="$emit('set-background')">
      Background Image
      <em><font-awesome-icon icon="image" /></em>
    </li>
    <li v-if="!isOfficialEdition" @click="$emit('image-opt-in')">
      <small>Show Custom Images</small>
      <em>
        <font-awesome-icon
          :icon="['fas', isImageOptIn ? 'check-square' : 'square']"
        />
      </em>
    </li>
    <li @click="$emit('toggle-static')">
      Disable Animations
      <em>
        <font-awesome-icon
          :icon="['fas', isStatic ? 'check-square' : 'square']"
        />
      </em>
    </li>
    <li @click="$emit('toggle-muted')">
      Mute Sounds
      <em>
        <font-awesome-icon
          :icon="['fas', isMuted ? 'volume-mute' : 'volume-up']"
        />
      </em>
    </li>
  </div>
</template>

<script>
export default {
  name: "GrimoireTab",
  props: {
    isActive: {
      type: Boolean,
      required: true,
    },
    playersCount: {
      type: Number,
      required: true,
      validator: (val) => val >= 0,
    },
    isPublic: {
      type: Boolean,
      required: true,
    },
    isNight: {
      type: Boolean,
      required: true,
    },
    isSpectator: {
      type: Boolean,
      required: true,
    },
    isNightOrder: {
      type: Boolean,
      required: true,
    },
    zoom: {
      type: Number,
      required: true,
    },
    isOfficialEdition: {
      type: Boolean,
      required: true,
    },
    isImageOptIn: {
      type: Boolean,
      required: true,
    },
    isStatic: {
      type: Boolean,
      required: true,
    },
    isMuted: {
      type: Boolean,
      required: true,
    },
  },
  emits: [
    "toggle-modal",
    "toggle-grimoire",
    "toggle-night",
    "toggle-night-order",
    "set-zoom",
    "set-background",
    "image-opt-in",
    "toggle-static",
    "toggle-muted",
  ],
};
</script>
