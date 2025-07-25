import { PermissionAction } from '@supabase/shared-types/out/constants'
import dayjs from 'dayjs'
import {
  ArrowRight,
  Clock,
  ExternalLink,
  GitPullRequest,
  Github,
  Infinity,
  MoreVertical,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { PropsWithChildren, ReactNode, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { toast } from 'sonner'

import { useParams } from 'common'
import { ButtonTooltip } from 'components/ui/ButtonTooltip'
import ShimmeringLoader from 'components/ui/ShimmeringLoader'
import { useBranchQuery } from 'data/branches/branch-query'
import { useBranchResetMutation } from 'data/branches/branch-reset-mutation'
import { useBranchUpdateMutation } from 'data/branches/branch-update-mutation'
import type { Branch } from 'data/branches/branches-query'
import { useCheckPermissions } from 'hooks/misc/useCheckPermissions'
import { useFlag } from 'hooks/ui/useFlag'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'ui'
import ConfirmationModal from 'ui-patterns/Dialogs/ConfirmationModal'
import BranchStatusBadge from './BranchStatusBadge'
import { EditBranchModal } from './EditBranchModal'
import WorkflowLogs from './WorkflowLogs'

interface BranchManagementSectionProps {
  header: string
  footer?: ReactNode
}

export const BranchManagementSection = ({
  header,
  footer,
  children,
}: PropsWithChildren<BranchManagementSectionProps>) => {
  return (
    <div className="border rounded-lg">
      <div className="bg-surface-100 shadow-sm flex justify-between items-center px-6 py-2 rounded-t-lg text-sm">
        {header}
      </div>
      <div className="bg-surface border-t shadow-sm rounded-b-lg text-sm divide-y">{children}</div>
      {footer !== undefined && <div className="bg-surface-100 px-6 py-1 border-t">{footer}</div>}
    </div>
  )
}

export const BranchRowLoader = () => {
  return (
    <div className="flex items-center justify-between px-6 py-2.5">
      <div className="flex items-center gap-x-4">
        <ShimmeringLoader className="w-52" />
        <ShimmeringLoader className="w-52" />
      </div>
      <div className="flex items-center gap-x-4">
        <ShimmeringLoader className="w-52" />
        <ShimmeringLoader className="w-52" />
      </div>
    </div>
  )
}

export const BranchLoader = () => {
  return (
    <>
      <BranchRowLoader />
      <BranchRowLoader />
      <BranchRowLoader />
      <BranchRowLoader />
      <BranchRowLoader />
    </>
  )
}

interface BranchRowProps {
  repo: string
  branch: Branch
  isMain?: boolean
  generateCreatePullRequestURL?: (branchName?: string) => string
  onSelectDeleteBranch: () => void
}

export const BranchRow = ({
  branch,
  isMain = false,
  repo,
  generateCreatePullRequestURL,
  onSelectDeleteBranch,
}: BranchRowProps) => {
  const { ref: projectRef } = useParams()
  const isActive = projectRef === branch?.project_ref
  const gitlessBranching = useFlag('gitlessBranching')

  const canDeleteBranches = useCheckPermissions(PermissionAction.DELETE, 'preview_branches')
  const canUpdateBranches = useCheckPermissions(PermissionAction.UPDATE, 'preview_branches')

  const daysFromNow = dayjs().diff(dayjs(branch.updated_at), 'day')
  const formattedTimeFromNow = dayjs(branch.updated_at).fromNow()
  const formattedUpdatedAt = dayjs(branch.updated_at).format('DD MMM YYYY, HH:mm:ss (ZZ)')

  const createPullRequestURL =
    generateCreatePullRequestURL?.(branch.git_branch) ?? 'https://github.com'

  const { ref, inView } = useInView()
  const { data } = useBranchQuery(
    { projectRef, id: branch.id },
    {
      enabled: inView,
      refetchInterval(data) {
        if (data?.status !== 'ACTIVE_HEALTHY') {
          return 1000 * 3 // 3 seconds
        }

        return false
      },
    }
  )

  const isBranchActiveHealthy = data?.status === 'ACTIVE_HEALTHY'

  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false)
  const [showBranchModeSwitch, setShowBranchModeSwitch] = useState(false)
  const [showEditBranchModal, setShowEditBranchModal] = useState(false)

  const { mutate: updateBranch, isLoading: isUpdating } = useBranchUpdateMutation({
    onSuccess() {
      toast.success('Successfully updated branch')
      setShowBranchModeSwitch(false)
    },
  })

  const onUpdateBranchPersistentMode = () => {
    if (projectRef == undefined) return console.error('Project ref is required')
    updateBranch({ id: branch.id, projectRef, persistent: !branch.persistent })
  }

  const { mutate: resetBranch, isLoading: isResetting } = useBranchResetMutation({
    onSuccess() {
      toast.success('Success! Please allow a few seconds for the branch to reset.')
      setShowConfirmResetModal(false)
    },
  })

  function onConfirmReset() {
    if (!projectRef) throw new Error('Invalid project reference')
    resetBranch({ id: branch.id, projectRef })
  }

  return (
    <div className="w-full flex items-center justify-between px-6 py-2.5" ref={ref}>
      <div className="flex items-center gap-x-4">
        <ButtonTooltip
          asChild
          type="default"
          className="max-w-[300px]"
          icon={
            isMain ? (
              <Shield strokeWidth={2} className="text-amber-900" />
            ) : branch.persistent ? (
              <Infinity size={16} />
            ) : null
          }
          tooltip={{
            content: {
              side: 'bottom',
              text: branch.persistent
                ? `${branch.name} is a persistent branch and will remain active even after the
                    underlying PR is closed`
                : 'Switch to branch',
            },
          }}
        >
          <Link href={`/project/${branch.project_ref}`} title={branch.name}>
            {branch.name}
          </Link>
        </ButtonTooltip>

        {branch.git_branch && <Github size={14} className="text-foreground-light" />}

        {isActive && <Badge>Current</Badge>}
        <BranchStatusBadge
          status={
            branch.status === 'CREATING_PROJECT' ? data?.status ?? branch.status : branch.status
          }
        />
        <p className="text-xs text-foreground-lighter">
          {daysFromNow > 1 ? `Updated on ${formattedUpdatedAt}` : `Updated ${formattedTimeFromNow}`}
        </p>
      </div>
      <div className="flex items-center gap-x-8">
        {isMain ? (
          <div className="flex items-center gap-x-2">
            {repo && (
              <>
                <Button asChild type="default" iconRight={<ExternalLink size={14} />}>
                  <Link
                    target="_blank"
                    rel="noreferrer"
                    passHref
                    href={`https://github.com/${repo}`}
                  >
                    View Repository
                  </Link>
                </Button>
                <WorkflowLogs projectRef={branch.project_ref} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="text" icon={<MoreVertical />} className="px-1" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="p-0 w-56" side="bottom" align="end">
                    <Link passHref href={`/project/${projectRef}/settings/integrations`}>
                      <DropdownMenuItem asChild className="gap-x-2">
                        <a>Change production branch</a>
                      </DropdownMenuItem>
                    </Link>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-x-2">
            {branch.git_branch && branch.pr_number === undefined ? (
              <Button asChild type="default" iconRight={<ExternalLink size={14} />}>
                <Link passHref target="_blank" rel="noreferrer" href={createPullRequestURL}>
                  Create Pull Request
                </Link>
              </Button>
            ) : branch.pr_number !== undefined ? (
              <div className="flex items-center">
                <Link
                  href={`https://github.com/${repo}/pull/${branch.pr_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-x-2 transition px-3 py-1 rounded-full bg-background-surface-400 hover:text-foreground"
                >
                  <GitPullRequest size={14} />#{branch.pr_number}
                </Link>
                <ArrowRight className="mx-1 text-foreground-light" strokeWidth={1.5} size={16} />
                <Button asChild type="default">
                  <Link
                    passHref
                    target="_blank"
                    rel="noreferer"
                    href={`http://github.com/${repo}/tree/${branch.git_branch}`}
                  >
                    {branch.git_branch}
                  </Link>
                </Button>
              </div>
            ) : null}
            <WorkflowLogs projectRef={branch.project_ref} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="text" icon={<MoreVertical />} className="px-1" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" side="bottom" align="end">
                <Tooltip>
                  <TooltipTrigger asChild={isBranchActiveHealthy} className="w-full">
                    <DropdownMenuItem
                      className="gap-x-2"
                      onSelect={() => setShowConfirmResetModal(true)}
                      onClick={() => setShowConfirmResetModal(true)}
                      disabled={isResetting || !isBranchActiveHealthy}
                    >
                      <RefreshCw size={14} />
                      Reset Branch
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  {!isBranchActiveHealthy && (
                    <TooltipContent side="left">
                      Branch is still initializing. Please wait for the branch to become healthy
                      before resetting
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild={isBranchActiveHealthy} className="w-full">
                    <DropdownMenuItem
                      className="gap-x-2"
                      onSelect={() => setShowBranchModeSwitch(true)}
                      onClick={() => setShowBranchModeSwitch(true)}
                      disabled={!isBranchActiveHealthy}
                    >
                      {branch.persistent ? (
                        <>
                          <Clock size={14} /> Switch to ephemeral
                        </>
                      ) : (
                        <>
                          <Infinity size={14} className="scale-110" /> Switch to persistent
                        </>
                      )}
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  {!isBranchActiveHealthy && (
                    <TooltipContent side="left">
                      Branch is still initializing. Please wait for the branch to become healthy
                      before switching modes
                    </TooltipContent>
                  )}
                </Tooltip>
                {gitlessBranching && (
                  <Tooltip>
                    <TooltipTrigger
                      asChild={canUpdateBranches && isBranchActiveHealthy}
                      className="w-full"
                    >
                      <DropdownMenuItem
                        className="gap-x-2"
                        disabled={!canUpdateBranches || !isBranchActiveHealthy || isUpdating}
                        onSelect={() => setShowEditBranchModal(true)}
                        onClick={() => setShowEditBranchModal(true)}
                      >
                        <Pencil size={14} />
                        Edit Branch
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    {(!canUpdateBranches || !isBranchActiveHealthy) && (
                      <TooltipContent side="left">
                        {!canUpdateBranches
                          ? 'You need additional permissions to edit branches'
                          : 'Branch is still initializing. Please wait for the branch to become healthy before editing.'}
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild={canDeleteBranches} className="w-full">
                    <DropdownMenuItem
                      className="gap-x-2"
                      disabled={!canDeleteBranches}
                      onSelect={() => onSelectDeleteBranch?.()}
                      onClick={() => onSelectDeleteBranch?.()}
                    >
                      <Trash2 size={14} />
                      Delete branch
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  {!canDeleteBranches && (
                    <TooltipContent side="left">
                      You need additional permissions to delete branches
                    </TooltipContent>
                  )}
                </Tooltip>
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmationModal
              variant={'destructive'}
              visible={showConfirmResetModal}
              confirmLabel="Reset branch"
              title="Confirm branch reset"
              loading={isResetting}
              onCancel={() => {
                setShowConfirmResetModal(false)
              }}
              onConfirm={onConfirmReset}
            >
              <p className="text-sm text-foreground-light">
                Are you sure you want to reset the "{branch.name}" branch? All data will be deleted.
              </p>
            </ConfirmationModal>

            <ConfirmationModal
              variant={'default'}
              visible={showBranchModeSwitch}
              confirmLabel={branch.persistent ? 'Switch to ephemeral' : 'Switch to persistent'}
              title={`Confirm branch mode switch`}
              loading={isUpdating}
              onCancel={() => {
                setShowBranchModeSwitch(false)
              }}
              onConfirm={onUpdateBranchPersistentMode}
            >
              <p className="text-sm text-foreground-light">
                Are you sure you want to switch the branch "{branch.name}" to{' '}
                {branch.persistent ? 'ephemeral' : 'persistent'} mode?
                <br />
                <br />
                {branch.persistent
                  ? 'Ephemeral branches will be deleted once the underlying PR closes.'
                  : 'Persistent branches will remain active even after the underlying PR is closed.'}
              </p>
            </ConfirmationModal>
          </div>
        )}
      </div>

      <EditBranchModal
        branch={branch}
        visible={showEditBranchModal}
        onClose={() => setShowEditBranchModal(false)}
      />
    </div>
  )
}
