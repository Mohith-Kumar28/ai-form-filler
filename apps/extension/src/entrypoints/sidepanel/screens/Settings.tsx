import type { DeletionReport } from '@aff/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Account } from '../../../generated/model/index.js'
import { openManageSubscription, openTrial, openUpgrade } from '../../../lib/billing.js'
import { plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { usePaywallSeen } from '../../../lib/paywall.js'
import {
  Body,
  Button,
  DeleteAccountSheet,
  Group,
  Header,
  Meter,
  Note,
  Row,
  Screen,
} from '../components.js'
import { IconArrowUpRight, IconTrash } from '../icons.js'
import { Mascot } from '../mascot.js'
import { useNavigation } from '../navigation.js'
import { OnThisPage } from './on-this-page.js'

const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' }

function trialDaysLeft(subscription: Account['subscription'], now = Date.now()): number | null {
  if (subscription?.status !== 'trial' || !subscription.trialEndsAt) return null
  const days = Math.ceil((subscription.trialEndsAt * 1000 - now) / 86_400_000)
  return days > 0 ? days : 0
}

function subscriptionNote(subscription: Account['subscription']): string | null {
  switch (subscription?.status) {
    case 'on_hold':
      return 'Your last payment did not go through. Update your card to keep access.'
    case 'cancelled':
      return 'Cancelled. You keep everything until the end of the period you have paid for.'
    case 'failed':
      return 'The payment never completed, so the subscription did not start.'
    case 'expired':
      return 'This subscription has ended.'
    case 'pending':
      return 'Setting up your subscription. This usually takes a moment.'
    default:
      return null
  }
}

export function Settings({
  account,
  documentCount = 0,
  onReplaySetup,
  onDeleted,
}: {
  account: Account
  documentCount?: number
  onReplaySetup?: () => void
  onDeleted?: (report: DeletionReport) => void
}) {
  const nav = useNavigation()
  const queryClient = useQueryClient()
  const { plan } = account.quota
  const { seen } = usePaywallSeen()
  const showMoney = account.subscription != null || seen || account.quota.used > 0
  const daysLeft = trialDaysLeft(account.subscription)
  const note = subscriptionNote(account.subscription)

  const signOut = useMutation({
    mutationFn: async () => {
      const result = await sendMessage({ type: 'auth/signOut' })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
    },
    onSuccess: () => {
      queryClient.setQueryData(['session'], false)
      queryClient.clear()
    },
  })

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  /*
    Straight to checkout. This screen used to open the offer sheet, which then had its own
    button to the same place — two clicks and a panel of copy in front of somebody who has
    already decided to pay. The sheet still exists, but for the paywall moments, where it is
    explaining an interruption rather than standing between a person and their card.
  */
  const checkout = useMutation({
    mutationFn: (kind: 'trial' | 'compare') => (kind === 'trial' ? openTrial() : openUpgrade()),
  })

  const deleteAccount = useMutation({
    mutationFn: async (confirmEmail: string) => {
      const result = await sendMessage({ type: 'account/delete', confirmEmail })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return result.value
    },
    onSuccess: (report) => {
      setConfirmingDelete(false)
      queryClient.setQueryData(['session'], false)
      queryClient.clear()
      onDeleted?.(report)
    },
  })

  return (
    <Screen>
      <Header title="Settings" onBack={nav.back} />
      <Body className="space-y-4 pt-1 pb-4">
        {/*
          What is left to spend leads, because it is the one thing here that changes and the
          reason anybody opens this screen twice. It still appears only once the person has met
          the money — before that it is an answer to a question they have not asked.
        */}
        {showMoney && (
          <Group title="Plan" aside={plan !== 'free' ? (PLAN_LABEL[plan] ?? plan) : undefined}>
            {account.quota.limit > 0 && <Meter {...account.quota} />}
            {plan === 'free' ? (
              <div className="px-3 py-2.5">
                <Button
                  variant="primary"
                  block
                  loading={checkout.isPending}
                  onClick={() => checkout.mutate('trial')}
                >
                  Start 14-day free trial
                </Button>
              </div>
            ) : (
              <>
                {daysLeft !== null && (
                  <p className="px-3 py-2 text-xs text-ink-muted">
                    {daysLeft === 0
                      ? 'Trial ends today, then $5 a month.'
                      : `Free trial · ${daysLeft} ${plural(daysLeft, 'day')} left, then $5 a month.`}
                  </p>
                )}
                {note && (
                  <div className="px-3 py-2">
                    <Note tone="warning">{note}</Note>
                  </div>
                )}
                <Row
                  icon={<IconArrowUpRight className="size-4" />}
                  title="Manage subscription"
                  detail="Change plan, update your card, or cancel"
                  onClick={() => void openManageSubscription()}
                />
                {plan !== 'ultra' && (
                  <Row title="Compare plans" onClick={() => checkout.mutate('compare')} />
                )}
              </>
            )}
            {checkout.isError && (
              <p role="alert" className="px-3 py-2 text-danger text-xs">
                {checkout.error.message}
              </p>
            )}
          </Group>
        )}

        {/* Untitled: this is who the screen is about, not a section of it. */}
        <Group>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            {account.avatarUrl ? (
              <img src={account.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
            ) : (
              <Mascot expression="happy" size={32} className="shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              {account.name && <p className="truncate text-sm text-ink">{account.name}</p>}
              <p className="truncate text-xs text-ink-dim">{account.email}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => signOut.mutate()}
              loading={signOut.isPending}
            >
              Sign out
            </Button>
          </div>
          {signOut.isError && (
            <p role="alert" className="px-3 py-2 text-xs text-danger">
              {signOut.error.message}
            </p>
          )}
        </Group>

        <OnThisPage />

        {onReplaySetup && (
          <Group title="Help">
            <Row
              icon={<Mascot size={16} />}
              title="Run setup again"
              detail="Add a document and check the basics. Nothing is removed."
              onClick={onReplaySetup}
            />
          </Group>
        )}

        <Group className="pt-4">
          <Row
            icon={<IconTrash className="size-4" />}
            tone="danger"
            title="Delete account"
            detail="Erases everything, permanently."
            onClick={() => setConfirmingDelete(true)}
          />
        </Group>
      </Body>

      {confirmingDelete && (
        <DeleteAccountSheet
          email={account.email}
          documentCount={documentCount}
          hasSubscription={account.subscription != null}
          pending={deleteAccount.isPending}
          error={deleteAccount.error?.message}
          onConfirm={(confirmEmail) => deleteAccount.mutate(confirmEmail)}
          onCancel={() => {
            setConfirmingDelete(false)
            deleteAccount.reset()
          }}
        />
      )}
    </Screen>
  )
}
