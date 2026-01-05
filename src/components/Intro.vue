<template>
  <div class="intro">
    <img src="/static/apple-icon.png" alt="" class="logo" />
    <div>
      Welcome to the (unofficial)
      <b>Virtual Grimoire</b> for Grim! Please add more players through the
      <span class="button" @click="toggleMenu">
        <font-awesome-icon icon="cog" /> Menu
      </span>
      on the top right or by pressing <b>[A]</b>. You can also join a game
      session by pressing <b>[J]</b>.<br />
      <div class="footer">
        This project is free and open source and can be found on
        <a href="https://github.com/gorewife/grimlive" target="_blank">GitHub</a
        >. It is not affiliated with The Pandemonium Institute. "Blood on the
        Clocktower" is a trademark of Steven Medway and The Pandemonium
        Institute.
      </div>
    </div>
    <a
      class="redirect"
      v-if="language === 'zh-CN'"
      href="https://clocktower.gstonegames.com"
    >
      <img src="../assets/gstone.webp" class="gstone" alt="" />
      你想使用中文版魔典吗？
    </a>
  </div>
</template>

<script>
import { mapMutations } from "vuex";

export default {
  data() {
    return {
      language: window.navigator.userLanguage || window.navigator.language,
    };
  },
  methods: mapMutations(["toggleMenu"]),
};
</script>

<style scoped lang="scss">
// Intro
.intro {
  text-align: center;
  width: 50%;
  font-size: 120%;
  position: absolute;
  padding: 10px;
  background: linear-gradient(
    135deg,
    rgba(42, 26, 61, 0.9) 0%,
    rgba(26, 15, 40, 0.95) 100%
  );
  backdrop-filter: blur(4px);
  border: 2px solid rgba(212, 175, 55, 0.3);
  box-shadow:
    0 0 30px rgba(123, 44, 191, 0.3),
    0 8px 20px rgba(0, 0, 0, 0.7),
    inset 0 0 40px rgba(139, 0, 0, 0.1);
  border-radius: 10px;
  z-index: 3;
  display: flex;
  justify-content: center;
  a {
    color: rgba(212, 175, 55, 0.9);
    transition: all 250ms ease;
  }
  a.redirect {
    display: block;
    text-decoration: none;
    position: absolute;
    top: 100%;
    margin-top: 2vh;
    padding: 10px;
    background: linear-gradient(
      135deg,
      rgba(42, 26, 61, 0.9) 0%,
      rgba(26, 15, 40, 0.95) 100%
    );
    backdrop-filter: blur(4px);
    border: 2px solid rgba(212, 175, 55, 0.3);
    box-shadow: 0 0 20px rgba(123, 44, 191, 0.3);
    border-radius: 10px;

    &:hover {
      color: rgba(212, 175, 55, 1);
      text-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
    }
    img {
      width: 120px;
      display: block;
      margin: auto;
      margin-bottom: 1vh;
    }
  }

  img.logo {
    position: absolute;
    bottom: 100%;
    width: 25vh;
    margin-bottom: 2vh;
    max-width: 192px;
    border-radius: 50%;
    box-shadow:
      0 0 30px rgba(123, 44, 191, 0.4),
      0 4px 20px rgba(0, 0, 0, 0.8);
    border: 3px solid rgba(212, 175, 55, 0.3);
  }
  .footer {
    font-size: 60%;
    opacity: 0.75;
  }
}
</style>
