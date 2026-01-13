<template>
  <div
    v-if="modals.journal"
    class="journal-window"
    :class="{ collapsed: isCollapsed }"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px',
      width: size.width + 'px',
      height: isCollapsed ? 'auto' : size.height + 'px',
    }"
  >
    <div class="journal-header" @mousedown="startDrag">
      <div class="title">
        <font-awesome-icon icon="book-open" />
        Journal
      </div>
      <div class="window-controls">
        <font-awesome-icon
          icon="undo"
          @click="resetPosition"
          class="control-btn"
          title="Reset Position"
        />
        <font-awesome-icon
          :icon="isCollapsed ? 'window-maximize' : 'window-minimize'"
          @click="toggleCollapse"
          class="control-btn"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
        />
        <font-awesome-icon
          icon="times"
          @click="toggleModal('journal')"
          class="control-btn close-btn"
          title="Close [J]"
        />
      </div>
    </div>

    <div v-if="!isCollapsed" class="journal-body">
      <div class="journal-controls">
        <div class="tabs">
          <div
            v-for="(section, index) in sections"
            :key="index"
            class="tab"
            :class="{ active: activeSection === index }"
            @click="activeSection = index"
          >
            {{ section.name }}
            <font-awesome-icon
              icon="times"
              class="delete-tab"
              @click.stop="deleteSection(index)"
              v-if="sections.length > 1"
            />
          </div>
          <div class="add-section">
            <font-awesome-icon
              icon="plus-circle"
              @click="showAddMenu = !showAddMenu"
            />
            <div class="add-menu" v-if="showAddMenu">
              <div @click="addSection('night')">
                Add Night <span class="shortcut">Ctrl+N</span>
              </div>
              <div @click="addSection('day')">
                Add Day <span class="shortcut">Ctrl+D</span>
              </div>
              <div @click="addSection('custom')">
                Custom Section <span class="shortcut">Ctrl+Shift+C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="journal-content">
        <textarea
          v-model="sections[activeSection].content"
          @input="saveJournal"
          :placeholder="`Write your notes for ${sections[activeSection].name}...`"
          class="parchment-textarea"
        ></textarea>
      </div>

      <div class="journal-footer">
        <div class="footer-link" @click="exportJournal">
          <font-awesome-icon icon="download" /> Export
        </div>
        <div class="footer-link danger" @click="clearAllNotes">
          <font-awesome-icon icon="trash" /> Clear All
        </div>
      </div>
    </div>

    <div
      v-if="!isCollapsed"
      class="resize-handle"
      @mousedown="startResize"
    ></div>
  </div>
</template>

<script>
import { mapMutations, mapState } from "vuex";

export default {
  data() {
    return {
      sections: [],
      activeSection: 0,
      showAddMenu: false,
      isCollapsed: false,
      position: { x: 100, y: 100 },
      size: { width: 600, height: 500 },
      isDragging: false,
      isResizing: false,
      dragStart: { x: 0, y: 0 },
      resizeStart: { width: 0, height: 0 },
    };
  },
  computed: {
    ...mapState(["modals"]),
  },
  mounted() {
    this.loadJournal();
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("keydown", this.handleKeyboard);
  },
  beforeUnmount() {
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("keydown", this.handleKeyboard);
  },
  methods: {
    ...mapMutations(["toggleModal"]),

    handleKeyboard(e) {
      // Only handle shortcuts if journal is open
      if (!this.modals.journal) return;

      // Ctrl+N for new night
      if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        this.addSection("night");
      }
      // Ctrl+D for new day
      else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        this.addSection("day");
      }
      // Ctrl+Shift+C for custom section (avoid conflict with copy)
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        this.addSection("custom");
      }
    },

    startDrag(e) {
      this.isDragging = true;
      this.dragStart = {
        x: e.clientX - this.position.x,
        y: e.clientY - this.position.y,
      };
    },

    startResize(e) {
      e.preventDefault();
      this.isResizing = true;
      this.resizeStart = {
        x: e.clientX,
        y: e.clientY,
        width: this.size.width,
        height: this.size.height,
      };
    },

    onMouseMove(e) {
      if (this.isDragging) {
        const newX = e.clientX - this.dragStart.x;
        const newY = e.clientY - this.dragStart.y;

        // Keep at least 50px of the header visible
        const minVisible = 50;
        const maxX = window.innerWidth - minVisible;
        const maxY = window.innerHeight - minVisible;

        this.position.x = Math.max(
          -this.size.width + minVisible,
          Math.min(maxX, newX),
        );
        this.position.y = Math.max(0, Math.min(maxY, newY));
        this.saveWindowState();
      } else if (this.isResizing) {
        const deltaX = e.clientX - this.resizeStart.x;
        const deltaY = e.clientY - this.resizeStart.y;
        this.size.width = Math.max(400, this.resizeStart.width + deltaX);
        this.size.height = Math.max(300, this.resizeStart.height + deltaY);
        this.saveWindowState();
      }
    },

    onMouseUp() {
      this.isDragging = false;
      this.isResizing = false;
    },

    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
      this.saveWindowState();
    },

    resetPosition() {
      this.position = { x: 100, y: 100 };
      this.size = { width: 600, height: 500 };
      this.saveWindowState();
    },

    addSection(type) {
      const getNextNumber = (sectionType) => {
        const numbers = this.sections
          .filter(s => s.type === sectionType)
          .map(s => parseInt(s.name.match(/\d+/)?.[0]))
          .filter(Boolean);
        
        for (let i = 1; i <= numbers.length + 1; i++) {
          if (!numbers.includes(i)) return i;
        }
      };

      let name = "";
      if (type === "night") {
        name = `Night ${getNextNumber("night")}`;
      } else if (type === "day") {
        name = `Day ${getNextNumber("day")}`;
      } else {
        name = prompt("Enter section name:");
        if (!name) return;
      }

      this.sections.push({ name, content: "", type });
      this.activeSection = this.sections.length - 1;
      this.showAddMenu = false;
      this.saveJournal();
    },

    deleteSection(index) {
      if (this.sections.length === 1) return;
      if (!confirm(`Delete "${this.sections[index].name}"?`)) return;

      this.sections.splice(index, 1);
      if (this.activeSection >= this.sections.length) {
        this.activeSection = this.sections.length - 1;
      }
      this.saveJournal();
    },

    saveJournal() {
      const journalData = {
        sections: this.sections,
      };
      localStorage.setItem("grimoire-journal", JSON.stringify(journalData));
    },

    saveWindowState() {
      const windowState = {
        position: this.position,
        size: this.size,
        isCollapsed: this.isCollapsed,
      };
      localStorage.setItem(
        "grimoire-journal-window",
        JSON.stringify(windowState),
      );
    },

    loadJournal() {
      // Load journal content
      const saved = localStorage.getItem("grimoire-journal");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.sections = data.sections || [];
        } catch (e) {
          console.error("Failed to load journal:", e);
        }
      }

      // Initialize with first night if empty
      if (this.sections.length === 0) {
        this.sections = [
          {
            name: "Night 1",
            content: "",
            type: "night",
          },
        ];
      }

      // Load window state
      const windowState = localStorage.getItem("grimoire-journal-window");
      if (windowState) {
        try {
          const state = JSON.parse(windowState);
          this.position = state.position || this.position;
          this.size = state.size || this.size;
          this.isCollapsed = state.isCollapsed || false;
        } catch (e) {
          console.error("Failed to load window state:", e);
        }
      }
    },

    exportJournal() {
      let text = "=== GRIMOIRE JOURNAL ===\n\n";
      this.sections.forEach((section) => {
        text += `\n=== ${section.name.toUpperCase()} ===\n`;
        text += section.content || "(No notes)\n";
      });

      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `grimoire-journal-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    clearAllNotes() {
      if (!confirm("Clear ALL notes? This cannot be undone!")) return;

      this.sections = [
        {
          name: "Night 1",
          content: "",
          type: "night",
        },
      ];
      this.activeSection = 0;
      this.saveJournal();
    },
  },
};
</script>

<style lang="scss" scoped>
.journal-window {
  position: fixed;
  z-index: 200;
  background: linear-gradient(
    135deg,
    rgba(42, 26, 61, 0.98) 0%,
    rgba(26, 15, 40, 0.99) 100%
  );
  backdrop-filter: blur(6px);
  border: 2px solid rgba(212, 175, 55, 0.4);
  border-radius: 12px;
  box-shadow:
    0 0 40px rgba(123, 44, 191, 0.5),
    0 12px 32px rgba(0, 0, 0, 0.8),
    inset 0 0 60px rgba(139, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: height 0.3s ease;

  &.collapsed {
    .journal-body {
      display: none;
    }
  }
}

.journal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(
    135deg,
    rgba(42, 26, 61, 0.95) 0%,
    rgba(26, 15, 40, 0.98) 100%
  );
  border-bottom: 2px solid rgba(212, 175, 55, 0.3);
  cursor: move;
  user-select: none;

  .title {
    color: #f5e6d3;
    font-family: "Crimson Text", "IM Fell English", serif;
    font-weight: 400;
    font-size: 1.2em;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 10px;

    svg {
      color: rgba(212, 175, 55, 0.8);
    }
  }

  .window-controls {
    display: flex;
    gap: 12px;

    .control-btn {
      cursor: pointer;
      color: rgba(212, 175, 55, 0.7);
      transition: all 250ms ease;
      font-size: 1.1em;

      &:hover {
        color: rgba(212, 175, 55, 1);
        transform: scale(1.15);
      }

      &.close-btn:hover {
        color: #8b0000;
      }
    }
  }
}

.journal-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.journal-controls {
  margin-bottom: 12px;

  .tabs {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    align-items: center;

    .tab {
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.6);
      border: 2px solid rgba(212, 175, 55, 0.3);
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      transition: all 250ms ease;
      color: #f5e6d3;
      font-family: "IM Fell English", "Crimson Text", serif;
      font-weight: 400;
      font-size: 0.95em;
      position: relative;

      &:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(212, 175, 55, 0.5);
      }

      &.active {
        background: rgba(0, 0, 0, 0.95);
        border-color: rgba(212, 175, 55, 0.7);
        box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
        color: rgba(212, 175, 55, 1);
      }

      .delete-tab {
        margin-left: 6px;
        opacity: 0.6;
        font-size: 0.85em;

        &:hover {
          opacity: 1;
          color: #8b0000;
        }
      }
    }

    .add-section {
      position: relative;
      margin-left: 5px;

      > svg {
        cursor: pointer;
        font-size: 1.3em;
        color: rgba(212, 175, 55, 0.7);
        transition: all 250ms ease;

        &:hover {
          color: rgba(212, 175, 55, 1);
          transform: scale(1.1);
        }
      }

      .add-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 5px;
        background: linear-gradient(
          135deg,
          rgba(0, 0, 0, 0.95) 0%,
          rgba(0, 0, 0, 0.98) 100%
        );
        border: 2px solid rgba(212, 175, 55, 0.3);
        border-radius: 8px;
        overflow: hidden;
        z-index: 100;
        box-shadow: 0 0 20px rgba(123, 44, 191, 0.4);

        div {
          padding: 8px 12px;
          cursor: pointer;
          color: #f5e6d3;
          white-space: nowrap;
          transition: all 250ms ease;
          font-size: 0.9em;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;

          .shortcut {
            font-size: 0.75em;
            opacity: 0.6;
            font-family: monospace;
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px;
            border-radius: 3px;
          }

          &:hover {
            background: rgba(0, 0, 0, 0.8);
            color: rgba(212, 175, 55, 1);

            .shortcut {
              opacity: 0.9;
            }
          }

          &:not(:last-child) {
            border-bottom: 1px solid rgba(212, 175, 55, 0.2);
          }
        }
      }
    }
  }
}

.journal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .parchment-textarea {
    width: 100%;
    height: 100%;
    flex: 1;
    padding: 15px;
    background: linear-gradient(
      135deg,
      rgba(245, 230, 211, 0.95) 0%,
      rgba(235, 220, 201, 0.97) 100%
    );
    background-image:
      linear-gradient(
        135deg,
        rgba(245, 230, 211, 0.95) 0%,
        rgba(235, 220, 201, 0.97) 100%
      ),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 28px,
        rgba(139, 0, 0, 0.03) 28px,
        rgba(139, 0, 0, 0.03) 29px
      );
    border: 2px solid rgba(139, 69, 19, 0.4);
    border-radius: 8px;
    box-shadow:
      inset 0 0 30px rgba(139, 69, 19, 0.1),
      0 4px 15px rgba(0, 0, 0, 0.3);
    color: #2a1810;
    font-family: "Crimson Text", "IM Fell English", serif;
    font-size: 1em;
    line-height: 1.7;
    resize: none;
    transition: all 250ms ease;

    &:focus {
      outline: none;
      border-color: rgba(139, 69, 19, 0.6);
      box-shadow:
        inset 0 0 30px rgba(139, 69, 19, 0.15),
        0 4px 20px rgba(0, 0, 0, 0.4),
        0 0 15px rgba(212, 175, 55, 0.2);
    }

    &::placeholder {
      color: rgba(42, 24, 16, 0.4);
      font-style: italic;
    }
  }
}

.journal-footer {
  display: flex;
  gap: 20px;
  justify-content: center;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 2px solid rgba(212, 175, 55, 0.3);

  .footer-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 0.9em;
    color: rgba(212, 175, 55, 0.8);
    cursor: pointer;
    transition: all 250ms ease;
    border-radius: 4px;

    svg {
      font-size: 0.9em;
    }

    &:hover {
      color: rgba(212, 175, 55, 1);
      background: rgba(212, 175, 55, 0.1);
      text-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
    }

    &.danger:hover {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
      text-shadow: 0 0 8px rgba(255, 107, 107, 0.3);
    }
  }
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;

  &::after {
    content: "";
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-right: 3px solid rgba(212, 175, 55, 0.5);
    border-bottom: 3px solid rgba(212, 175, 55, 0.5);
    border-bottom-right-radius: 4px;
  }

  &:hover::after {
    border-color: rgba(212, 175, 55, 0.8);
  }
}

@media (max-width: 768px) {
  .journal-window {
    left: 5% !important;
    top: 5% !important;
    width: 90% !important;
    max-width: 90%;

    .tabs {
      font-size: 0.85em;

      .tab {
        padding: 5px 8px;
      }
    }
  }

  .journal-content .parchment-textarea {
    font-size: 0.95em;
  }
}
</style>
