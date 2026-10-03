import { ShieldPlus } from 'lucide-react'

export default function Brand({ light = false }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-bold tracking-tight">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-white">
        <ShieldPlus size={19} />
      </span>
      <span className={light ? 'text-white' : 'text-ink'}>CareVault</span>
    </span>
  )
}
