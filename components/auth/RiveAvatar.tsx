"use client"

import { useRive, useStateMachineInput, Layout, Fit, Alignment } from "@rive-app/react-canvas"
import { useEffect } from "react"

interface RiveAvatarProps {
  isChecking: boolean
  isHandsUp: boolean
  lookValue: number
  state?: "success" | "fail" | null // Novo controlo para gatilhos
}

export function RiveAvatar({ isChecking, isHandsUp, lookValue, state }: RiveAvatarProps) {
  const { rive, RiveComponent } = useRive({
    src: "/teddy.riv",
    stateMachines: "Login Machine", // Nome correto para os inputs funcionarem
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center })
  })

  // Sensores de estado
  const checkInput = useStateMachineInput(rive, "Login Machine", "isChecking")
  const handsUpInput = useStateMachineInput(rive, "Login Machine", "isHandsUp")
  const lookInput = useStateMachineInput(rive, "Login Machine", "numLook")
  
  // Gatilhos (Triggers) do Teddy
  const successTrigger = useStateMachineInput(rive, "Login Machine", "trigSuccess")
  const failTrigger = useStateMachineInput(rive, "Login Machine", "trigFail")

  useEffect(() => {
    if (checkInput) checkInput.value = isChecking
  }, [isChecking, checkInput])

  useEffect(() => {
    if (handsUpInput) handsUpInput.value = isHandsUp
  }, [isHandsUp, handsUpInput])

  useEffect(() => {
    if (lookInput) lookInput.value = lookValue
  }, [lookValue, lookInput])

  // Dispara animações de feedback do banco de dados
  useEffect(() => {
    if (state === "success" && successTrigger) successTrigger.fire()
    if (state === "fail" && failTrigger) failTrigger.fire()
  }, [state, successTrigger, failTrigger])

  return (
    <div className="h-64 w-full flex justify-center overflow-hidden bg-zinc-50 rounded-t-xl">
      <RiveComponent className="h-full w-full" />
    </div>
  )
}