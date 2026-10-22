import { create } from "zustand"

export type LeaderPhase = "idle" | "waitingSecondKey"

type LeaderStore = {
  phase: LeaderPhase
  commandPaletteOpen: boolean
  enterLeaderMode: () => void
  cancel: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
}

export const useLeaderStore = create<LeaderStore>()((set) => ({
  phase: "idle",
  commandPaletteOpen: false,
  enterLeaderMode: () => set({ phase: "waitingSecondKey" }),
  cancel: () => set({ phase: "idle" }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
}))
