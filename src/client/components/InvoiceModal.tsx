import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { ImageDown, Printer } from 'lucide-react'
import type { RentBill, Tenant } from '../lib/api'
import { fmtBaht, fmtNum, fmtThaiDateSlash, periodLabel, UTILITY_RATE } from '../lib/format'
import { ErrorText } from './ui'

const BUSINESS = {
  name: 'เดอะไวท์โฮม อุดรธานี - ห้าง 24 ชม.',
  address: '46/161 ถ.โรงพยาบาลจิตระเลิศ (รอบเมือง) ต.หมากแข้ง อ.เมือง จ.อุดรธานี',
  phone: '094-298-9935',
  email: 'thewhitehomeudon@gmail.com',
  line: '@thewhitehomeudon',
}

interface Row {
  no: number
  label: string
  sub?: string
  quantity: string
  unitPrice: string
  amount: string
}

/** ใบวางบิลค่าเช่ารายเดือน — พิมพ์/บันทึก PDF และบันทึกภาพ PNG ได้ */
export function InvoiceModal({
  bill,
  tenant,
  onClose,
}: {
  bill: RentBill
  tenant: Tenant
  onClose: () => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const rows: Row[] = []
  let no = 1
  rows.push({
    no: no++,
    label: `ค่าห้องพักประจำเดือน ${periodLabel(bill.period)}`,
    quantity: '1 ห้อง',
    unitPrice: fmtNum(bill.rentAmount),
    amount: fmtNum(bill.rentAmount),
  })
  if (bill.electricAmount > 0)
    rows.push({
      no: no++,
      label: 'ค่าไฟฟ้า',
      sub:
        bill.electricMeterPrev || bill.electricMeterCurr
          ? `(เลขมิเตอร์เดิม ${bill.electricMeterPrev ?? '-'} ปัจจุบัน ${bill.electricMeterCurr ?? '-'})`
          : undefined,
      quantity: bill.electricUnits != null ? `${fmtNum(bill.electricUnits)} หน่วย` : '1 ห้อง',
      unitPrice: bill.electricUnits != null ? fmtNum(UTILITY_RATE) : fmtNum(bill.electricAmount),
      amount: fmtNum(bill.electricAmount),
    })
  if (bill.waterAmount > 0)
    rows.push({
      no: no++,
      label: 'ค่าน้ำประจำเดือน',
      sub:
        bill.waterMeterPrev || bill.waterMeterCurr
          ? `(เลขมิเตอร์เดิม ${bill.waterMeterPrev ?? '-'} ปัจจุบัน ${bill.waterMeterCurr ?? '-'})`
          : undefined,
      quantity: bill.waterUnits != null ? `${fmtNum(bill.waterUnits)} หน่วย` : '1 ห้อง',
      unitPrice: bill.waterUnits != null ? fmtNum(UTILITY_RATE) : fmtNum(bill.waterAmount),
      amount: fmtNum(bill.waterAmount),
    })
  if (bill.otherAmount > 0)
    rows.push({
      no: no++,
      label: bill.note ? `ค่า${bill.note}` : 'ค่าบริการอื่นๆ',
      quantity: '1 รายการ',
      unitPrice: fmtNum(bill.otherAmount),
      amount: fmtNum(bill.otherAmount),
    })
  while (rows.length < 5) rows.push({ no: no++, label: '', quantity: '', unitPrice: '', amount: '' })

  const savePng = async () => {
    if (!sheetRef.current) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await toPng(sheetRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `invoice-${bill.roomNumber}-${bill.period}.png`
      a.click()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const th = 'border border-black px-2 py-1.5 text-[13px] font-bold'
  const td = 'border border-black px-2 py-1.5 text-[13px] align-top'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-800/80">
      {/* แถบปุ่ม (ไม่ออกในภาพ/เอกสาร) */}
      <div className="flex items-center gap-2 px-3 py-2 print:hidden">
        <button type="button" onClick={onClose} className="btn-ghost !px-3 !py-2 !text-white">
          ปิด
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => window.print()} className="btn-secondary !px-3 !py-2 !text-sm">
          <Printer size={16} /> พิมพ์ / บันทึก PDF
        </button>
        <button type="button" onClick={savePng} disabled={busy} className="btn-primary !px-3 !py-2 !text-sm">
          <ImageDown size={16} /> {busy ? 'กำลังสร้าง…' : 'บันทึกภาพ PNG'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-6 print:overflow-visible print:p-0">
        <ErrorText error={error} />
        {/* แผ่นใบวางบิล */}
        <div
          ref={sheetRef}
          className="invoice-sheet mx-auto w-full max-w-[720px] bg-white p-6 text-black shadow-xl print:max-w-none print:shadow-none"
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
            <img src="/logo.png" alt="The White Home" className="w-36 shrink-0 object-contain" />
            <div className="text-right text-[12.5px] leading-relaxed">
              <p className="text-[15px] font-bold">{BUSINESS.name}</p>
              <p>{BUSINESS.address}</p>
              <p>โทร: {BUSINESS.phone}</p>
              <p>E-mail: {BUSINESS.email}</p>
              <p>Line: {BUSINESS.line}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <h1 className="text-xl font-bold underline underline-offset-4">
              ใบวางบิลค่าเช่าเดือน{periodLabel(bill.period)}
            </h1>
            {bill.status === 'paid' && (
              <span className="rotate-6 rounded-lg border-2 border-red-600 px-2 py-0.5 text-sm font-bold text-red-600">
                ชำระแล้ว
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px]">
            <p>
              <b>ชื่อผู้เช่า :</b> {tenant.name}
            </p>
            <p>
              <b>เลขที่ :</b> ห้อง {bill.roomNumber}
            </p>
            <p className="break-words">
              <b>ที่อยู่ :</b> {tenant.address || '-'}
            </p>
            <p>
              <b>วันที่ :</b> {fmtThaiDateSlash(bill.paidDate ?? new Date().toISOString().slice(0, 10))}
            </p>
          </div>

          <p className="mt-5 mb-1 text-center text-[13px] font-bold">โทร: {BUSINESS.phone}</p>

          <table className="mt-1 w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-14`}>ลำดับที่</th>
                <th className={th}>รายการ</th>
                <th className={`${th} w-24 text-center`}>จำนวน</th>
                <th className={`${th} w-28 text-center`}>ราคาต่อหน่วย</th>
                <th className={`${th} w-28 text-center`}>จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.no}>
                  <td className={`${td} text-center`}>{r.no}</td>
                  <td className={td}>
                    {r.label}
                    {r.sub && <span className="block text-[11.5px] leading-snug">{r.sub}</span>}
                  </td>
                  <td className={`${td} text-center`}>{r.quantity}</td>
                  <td className={`${td} text-center`}>{r.unitPrice}</td>
                  <td className={`${td} text-right`}>{r.amount ? `${r.amount}บาท` : ''}</td>
                </tr>
              ))}
              <tr>
                <td className={`${td} text-center font-bold`}>รวม</td>
                <td className={`${td} font-bold`} colSpan={3}>
                  จำนวนเงินรวมทั้งสิ้น
                </td>
                <td className={`${td} text-right font-bold`}>{fmtNum(bill.totalAmount)}บาท</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-10 text-[14px]">
            ลงชื่อ.............................................ผู้รับเงิน
          </div>
        </div>
      </div>
      <p className="pb-2 text-center text-[11px] text-neutral-300 print:hidden">
        หน่วยละ {UTILITY_RATE} บาท · ยอดรวม {fmtBaht(bill.totalAmount)}
      </p>
    </div>
  )
}
