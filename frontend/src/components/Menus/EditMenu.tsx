import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  type MenuPublic,
  type MenuUpdate,
  PageSystemMenusService,
} from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { getMenuIcon } from "@/lib/getMenuIcon"
import { handleError } from "@/utils"

const ROOT_PARENT_VALUE = "__root__"

const formSchema = z.object({
  key: z.string().min(1, { message: "Key is required" }),
  label: z.string().min(1, { message: "Label is required" }),
  path: z.string().optional(),
  parent_id: z.string(),
  sort_order: z.coerce.number().int(),
  icon: z.string().optional(),
  is_active: z.boolean(),
  is_visible: z.boolean(),
  access_policy: z.enum(["role", "authenticated"]),
})

type FormData = z.infer<typeof formSchema>

interface EditMenuProps {
  menu: MenuPublic
  menus: MenuPublic[]
  onSuccess: () => void
}

// 將表單資料整理成更新 Menu payload
function toMenuUpdatePayload(data: FormData): MenuUpdate {
  return {
    key: data.key,
    label: data.label,
    path: data.path || null,
    parent_id: data.parent_id === ROOT_PARENT_VALUE ? null : data.parent_id,
    sort_order: data.sort_order,
    icon: data.icon || null,
    is_active: data.is_active,
    is_visible: data.is_visible,
    access_policy: data.access_policy,
  }
}

// 顯示編輯 Menu dialog
const EditMenu = ({ menu, menus, onSuccess }: EditMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const parentOptions = menus.filter((candidate) => candidate.id !== menu.id)

  const form = useForm<z.input<typeof formSchema>, unknown, FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      key: menu.key,
      label: menu.label,
      path: menu.path ?? "",
      parent_id: menu.parent_id ?? ROOT_PARENT_VALUE,
      sort_order: menu.sort_order ?? 0,
      icon: menu.icon ?? "",
      is_active: menu.is_active ?? true,
      is_visible: menu.is_visible ?? true,
      access_policy:
        menu.access_policy === "authenticated" ? "authenticated" : "role",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: MenuUpdate) =>
      PageSystemMenusService.updateMenu({ id: menu.id, requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Menu updated successfully")
      setIsOpen(false)
      onSuccess()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] })
    },
  })

  // 送出編輯 Menu 表單
  const onSubmit = (data: FormData) => {
    mutation.mutate(toMenuUpdatePayload(data))
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem
        onSelect={(event) => event.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <Pencil />
        Edit Menu
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit Menu</DialogTitle>
              <DialogDescription>
                Update this menu item. Sidebar changes apply after refresh.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Key <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="system.menus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Label <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Menu management" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Root menu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ROOT_PARENT_VALUE}>Root</SelectItem>
                        {parentOptions.map((parent) => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/system/menus" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => {
                    const IconPreview = getMenuIcon(field.value)
                    return (
                      <FormItem>
                        <FormLabel>Icon</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <IconPreview className="size-4 shrink-0 text-muted-foreground" />
                            <Input placeholder="Menu" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>

              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value as number}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="access_policy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Policy</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Role based" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="role">Role based</SelectItem>
                        <SelectItem value="authenticated">
                          All authenticated users
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Active</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_visible"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Visible</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Save
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditMenu
