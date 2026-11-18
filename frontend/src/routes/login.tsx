import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { LogIn, PanelRightClose } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { Body_login_login_access_token as AccessToken } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import { LoginAside } from "@/components/Common/LoginAside"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

const formSchema = z.object({
  username: z.email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .min(8, { message: "Password must be at least 8 characters" }),
}) satisfies z.ZodType<AccessToken>

type FormData = z.infer<typeof formSchema>

const GUEST_ACCOUNT: FormData = {
  username: "viewer@example.com",
  password: "changethis",
}
const GUEST_LOGIN_DELAY_MS = 2000
const LOGIN_PANEL_STORAGE_KEY = "login-panel-collapsed"

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Log In - DoDo Admin",
      },
    ],
  }),
})

function Login() {
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LOGIN_PANEL_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })
  const openLoginButton = useRef<HTMLButtonElement>(null)
  const closeLoginButton = useRef<HTMLButtonElement>(null)
  const restorePanelFocus = useRef(false)

  const toggleLoginPanel = () => {
    restorePanelFocus.current = true
    setPanelCollapsed((collapsed) => !collapsed)
  }

  useEffect(() => {
    try {
      localStorage.setItem(LOGIN_PANEL_STORAGE_KEY, String(panelCollapsed))
    } catch {
      // 瀏覽器禁止儲存時，仍可在本次頁面中收合與展開。
    }
    if (restorePanelFocus.current) {
      ;(panelCollapsed ? openLoginButton : closeLoginButton).current?.focus()
      restorePanelFocus.current = false
    }
  }, [panelCollapsed])
  const { loginMutation } = useAuth()
  const [guestLoading, setGuestLoading] = useState(false)
  const guestTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(data)
  }

  // 訪客登入：先填入帳密，顯示登入中 2 秒後才送出。
  const guestLogin = () => {
    if (guestLoading || loginMutation.isPending) return
    form.setValue("username", GUEST_ACCOUNT.username)
    form.setValue("password", GUEST_ACCOUNT.password)
    setGuestLoading(true)
    guestTimer.current = setTimeout(() => {
      loginMutation.mutate(GUEST_ACCOUNT, {
        onSettled: () => setGuestLoading(false),
      })
    }, GUEST_LOGIN_DELAY_MS)
  }

  useEffect(() => () => clearTimeout(guestTimer.current), [])

  return (
    <AuthLayout
      panelId="login-panel"
      panelHidden={panelCollapsed}
      aside={
        <LoginAside
          loginAction={
            panelCollapsed ? (
              <Button
                ref={openLoginButton}
                type="button"
                variant="outline"
                onClick={toggleLoginPanel}
                aria-expanded={false}
                aria-controls="login-panel"
              >
                <LogIn aria-hidden="true" />
                開啟登入
              </Button>
            ) : null
          }
        />
      }
      panelHeader={
        <Button
          ref={closeLoginButton}
          type="button"
          variant="ghost"
          className="self-end"
          onClick={toggleLoginPanel}
          aria-expanded={true}
          aria-controls="login-panel"
        >
          <PanelRightClose aria-hidden="true" />
          收合登入區
        </Button>
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">Login to your account</h1>
          </div>

          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder="user@example.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel>Password</FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="ml-auto text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="Password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={loginMutation.isPending && !guestLoading}
              disabled={guestLoading}
            >
              Log In
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="outline"
              loading={guestLoading}
              disabled={loginMutation.isPending}
              onClick={guestLogin}
            >
              {guestLoading ? "請稍等，登入中…" : "訪客登入"}
            </LoadingButton>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
