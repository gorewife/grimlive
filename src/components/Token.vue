<template>
  <div class="token" @click="setRole" :class="[role.id]">
    <span
      class="icon"
      v-if="role.id"
      :style="{
        backgroundImage: `url(${getImage(role)})`,
      }"
    ></span>
    <span
      class="leaf-left"
      v-if="role.firstNight || role.firstNightReminder"
    ></span>
    <span
      class="leaf-right"
      v-if="role.otherNight || role.otherNightReminder"
    ></span>
    <span v-if="reminderLeaves" :class="['leaf-top' + reminderLeaves]"></span>
    <span class="leaf-orange" v-if="role.setup"></span>
    <svg viewBox="0 0 150 150" class="name">
      <path
        d="M 13 75 C 13 160, 138 160, 138 75"
        id="curve"
        fill="transparent"
      />
      <text
        width="150"
        x="66.6%"
        text-anchor="middle"
        class="label mozilla"
        :font-size="nameToFontSize"
      >
        <textPath xlink:href="#curve">
          {{ role.name }}
        </textPath>
      </text>
    </svg>
    <div class="edition" :class="[`edition-${role.edition}`, role.team]"></div>
    <div class="ability" v-if="role.ability">
      {{ role.ability }}
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { iconImages } from "@/utils/images";

export default {
  name: "Token",
  props: {
    role: {
      type: Object,
      required: true,
      validator: (role) => {
        // Allow empty role object for placeholder tokens
        if (!role.id) return true;
        // Validate required role properties
        return (
          typeof role.id === "string" &&
          typeof role.name === "string" &&
          (!role.team ||
            [
              "townsfolk",
              "outsider",
              "minion",
              "demon",
              "traveller",
              "fabled",
              "loric",
            ].includes(role.team))
        );
      },
    },
    alignmentIndex: {
      type: Number,
      default: 0,
      validator: (val) => val >= 0 && val <= 2,
    },
  },
  computed: {
    reminderLeaves: function () {
      return (
        (this.role.reminders || []).length +
        (this.role.remindersGlobal || []).length
      );
    },
    nameToFontSize: function () {
      const name = this.role.name;
      return name && name.length > 10 ? "90%" : "110%";
    },
    ...mapState(["grimoire"]),
  },
  data() {
    return {};
  },
  methods: {
    getImage(role) {
      if (role.image && this.grimoire.isImageOptIn) {
        if (Array.isArray(role.image)) {
          return role.image[this.alignmentIndex] || role.image[0];
        }
        return role.image;
      }

      // Construct the path to match the glob import keys
      const path =
        "../assets/icons/" +
        (this.alignmentIndex > 0 ? "Alternate/" : "") +
        (role.imageAlt || role.id) +
        (this.role.team === "traveller"
          ? this.alignmentIndex === 1
            ? "_g"
            : this.alignmentIndex === 2
              ? "_e"
              : ""
          : "") +
        ".webp";

      // Return the imported image URL
      return iconImages[path] || "";
    },
    setRole() {
      this.$emit("set-role");
    },
  },
};
</script>

<style scoped lang="scss">
.token {
  border-radius: 50%;
  width: 100%;
  background: url("../assets/token.webp") center center;
  background-size: 100%;
  text-align: center;
  border: 3px solid #2a1a3d;
  box-shadow:
    0 0 20px rgba(123, 44, 191, 0.3),
    0 4px 15px rgba(0, 0, 0, 0.6),
    inset 0 0 30px rgba(139, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 350ms ease;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: -3px;
    left: -3px;
    right: -3px;
    bottom: -3px;
    border-radius: 50%;
    border: 1px solid rgba(212, 175, 55, 0.2);
    pointer-events: none;
  }

  &:hover {
    transform: scale(1.05);
    border-color: #4a2a5d;
    box-shadow:
      0 0 30px rgba(123, 44, 191, 0.5),
      0 6px 20px rgba(0, 0, 0, 0.8),
      inset 0 0 40px rgba(139, 0, 0, 0.15);
  }

  &:hover .name .label {
    stroke: black;
    fill: white;
    @-moz-document url-prefix() {
      &.mozilla {
        stroke: none;
        filter: drop-shadow(0 1.5px 0 black) drop-shadow(0 -1.5px 0 black)
          drop-shadow(1.5px 0 0 black) drop-shadow(-1.5px 0 0 black)
          drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
      }
    }
  }

  .icon,
  &:before {
    background-size: 65%;
    background-repeat: no-repeat;
    background-position: center center;
    position: absolute;
    width: 100%;
    height: 100%;
    margin-top: 3%;
  }

  span {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: 100%;
    pointer-events: none;

    &.leaf-left {
      background-image: url("../assets/leaf-left.webp");
    }

    &.leaf-orange {
      background-image: url("../assets/leaf-orange.webp");
    }

    &.leaf-right {
      background-image: url("../assets/leaf-right.webp");
    }

    &.leaf-top1 {
      background-image: url("../assets/leaf-top1.webp");
    }

    &.leaf-top2 {
      background-image: url("../assets/leaf-top2.webp");
    }

    &.leaf-top3 {
      background-image: url("../assets/leaf-top3.webp");
    }

    &.leaf-top4 {
      background-image: url("../assets/leaf-top4.webp");
    }

    &.leaf-top5 {
      background-image: url("../assets/leaf-top5.webp");
    }

    &.leaf-top6 {
      background-image: url("../assets/leaf-top6.webp");
    }

    &.leaf-top7 {
      background-image: url("../assets/leaf-top7.webp");
    }
  }

  .name {
    width: 100%;
    height: 100%;
    font-size: 24px; // svg fonts are relative to document font size
    .label {
      fill: #f5e6d3;
      stroke: #000000;
      stroke-width: 3px;
      paint-order: stroke;
      font-family: "Sorts Mill Goudy", serif;
      font-weight: bold;
      text-shadow:
        0 0 10px rgba(0, 0, 0, 0.8),
        0 2px 4px rgba(0, 0, 0, 0.9);
      letter-spacing: 1.5px;
      filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.6));

      @-moz-document url-prefix() {
        &.mozilla {
          // Vue doesn't support scoped media queries, so we have to use a second css class
          stroke: none;
          text-shadow:
            0 2px 0 black,
            0 -2px 0 black,
            2px 0 0 black,
            -2px 0 0 black,
            0 3px 3px rgba(0, 0, 0, 0.8);
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
        }
      }
    }
  }

  .edition {
    position: absolute;
    right: 0;
    bottom: 5px;
    width: 23px;
    height: 23px;
    background-size: 100%;
    display: none;
  }

  .ability {
    display: flex;
    position: absolute;
    padding: 5px 10px;
    left: 120%;
    width: 250px;
    z-index: 25;
    font-size: 80%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    text-align: left;
    justify-items: center;
    align-content: center;
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease-in-out;

    &:before {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      border-right-color: black;
      position: absolute;
      margin-right: 2px;
      right: 100%;
    }
  }

  &:hover .ability {
    opacity: 1;
  }
}
</style>
