export const ACCESS_HISTORY_PAGE_SIZE = 6

export function effectiveGrantStatus(grant, now = Date.now()) {
  if (grant.status === 'revoked') return 'revoked'
  if (grant.status === 'active' && new Date(grant.expiresAt).getTime() > now) return 'active'
  return 'expired'
}

export function canRevokeAccess(grant, now = Date.now()) {
  return grant.status === 'active' && effectiveGrantStatus(grant, now) === 'active'
}

export function filterAccessHistory(grants, { status = 'all', search = '', isDoctor = false, now = Date.now() } = {}) {
  const term = search.trim().toLocaleLowerCase()
  return grants.filter((grant) => {
    if (status !== 'all' && effectiveGrantStatus(grant, now) !== status) return false
    if (!term) return true
    const person = isDoctor ? grant.patient : grant.doctor
    return `${person?.name || ''} ${person?.email || ''}`.toLocaleLowerCase().includes(term)
  })
}

export function countAccessHistory(grants, now = Date.now()) {
  return grants.reduce((counts, grant) => {
    counts[effectiveGrantStatus(grant, now)] += 1
    counts.all += 1
    return counts
  }, { all: 0, active: 0, expired: 0, revoked: 0 })
}

export function paginateAccessHistory(items, requestedPage, pageSize = ACCESS_HISTORY_PAGE_SIZE) {
  const pageCount = Math.ceil(items.length / pageSize)
  const page = pageCount ? Math.min(Math.max(1, requestedPage), pageCount) : 1
  const start = items.length ? (page - 1) * pageSize : 0
  return {
    page,
    pageCount,
    items: items.slice(start, start + pageSize),
    start: items.length ? start + 1 : 0,
    end: Math.min(start + pageSize, items.length),
  }
}

export function visiblePageNumbers(page, pageCount) {
  if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const first = Math.max(1, Math.min(page - 2, pageCount - 4))
  return Array.from({ length: 5 }, (_, index) => first + index)
}
