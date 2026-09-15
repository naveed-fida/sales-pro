import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { appNavWithHotkeys } from '@/lib/hotkeys'

export function AppHotkeys(): null {
  const navigate = useNavigate()
  const nav = appNavWithHotkeys()

  useHotkeys(
    nav.map((item) => item.combo).join(','),
    (event) => {
      const item = nav.find((entry) => entry.digit === event.key)
      if (item) navigate(item.path)
    },
    { preventDefault: true, enableOnFormTags: true },
  )

  return null
}
