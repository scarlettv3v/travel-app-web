// The sums behind the Expenses page. Kept in its own file so they are easy to check.
//
// A PERSONAL expense is one where only the person who paid shares it (split = just the payer).
// Everything else is a SHARED expense. Personal expenses never change who owes who.

export const isPersonal = e => e.split.length === 1 && e.split[0] === e.payer;

// One row per person: what they paid, what they spent on themselves (personal),
// their share of shared expenses, and the difference.
//   share   = personal + shared   (everything spent on them)
//   balance = paid - share        (plus = others owe them, minus = they owe others)
export function buildStats(expenses, memberNames = []) {
  const rows = {};
  const row = name => {
    if (!rows[name]) rows[name] = { name, paid: 0, personal: 0, shared: 0 };
    return rows[name];
  };
  memberNames.forEach(row); // keeps the members in their usual order

  expenses.forEach(e => {
    if (e.payer) row(e.payer).paid += e.amountBase;
    if (!e.split.length) return;
    if (isPersonal(e)) {
      row(e.payer).personal += e.amountBase;
      return;
    }
    const each = e.amountBase / e.split.length;
    e.split.forEach(name => {
      row(name).shared += each;
    });
  });

  return Object.values(rows).map(r => ({
    ...r,
    share: r.personal + r.shared,
    balance: r.paid - (r.personal + r.shared),
  }));
}

// Simplest transfers to settle up (same method as before)
export function buildTransfers(stats) {
  const debtors = stats
    .filter(r => r.balance < -0.005)
    .map(r => ({ name: r.name, amount: -r.balance }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = stats
    .filter(r => r.balance > 0.005)
    .map(r => ({ name: r.name, amount: r.balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const value = Math.min(debtors[d].amount, creditors[c].amount);
    transfers.push({ from: debtors[d].name, to: creditors[c].name, amount: value });
    debtors[d].amount -= value;
    creditors[c].amount -= value;
    if (debtors[d].amount < 0.005) d++;
    if (creditors[c].amount < 0.005) c++;
  }
  return transfers;
}

// type: 'all' | 'shared' | 'personal'.  who: 'all' | 'me' (you paid it or you share it)
export function filterExpenses(list, { type = 'all', who = 'all', me = '' } = {}) {
  return list.filter(e => {
    if (type === 'personal' && !isPersonal(e)) return false;
    if (type === 'shared' && isPersonal(e)) return false;
    if (who === 'me' && !(e.payer === me || e.split.includes(me))) return false;
    return true;
  });
}

// How much of this expense is "mine" (my share of it)
export const myShareOf = (e, me) =>
  e.split.length && e.split.includes(me) ? e.amountBase / e.split.length : 0;

// "My spending" breakdown, for ONE person. This is only for the My spending card.
// It never changes the totals, the shared / personal split, or who owes who.
//
//   paid        everything I paid (on expenses that have people to split between)
//   forOthers   the part of that which was other people's share (they will repay me)
//   ownPaid     paid - forOthers: the part of what I paid that was my own cost
//   byOthers    my share of expenses that someone else paid (I will repay them)
//   share       ownPaid + byOthers = everything spent on me (same as "Spent" in the table)
//   toMe        { name: amount }  what each person's share of my payments comes to
//   fromOthers  { name: amount }  what I owe each person for their payments
// These are gross amounts per expense. "Who owes who" nets everyone together, so its
// transfers can be smaller than these.
export function myFlows(expenses, me) {
  const out = { paid: 0, forOthers: 0, ownPaid: 0, byOthers: 0, share: 0, toMe: {}, fromOthers: {} };
  expenses.forEach(e => {
    if (!e.split.length) return;
    const each = e.amountBase / e.split.length;
    if (e.payer === me) {
      out.paid += e.amountBase;
      e.split.forEach(name => {
        if (name === me) {
          out.ownPaid += each;
        } else {
          out.forOthers += each;
          out.toMe[name] = (out.toMe[name] || 0) + each;
        }
      });
    } else if (e.split.includes(me)) {
      out.byOthers += each;
      out.fromOthers[e.payer] = (out.fromOthers[e.payer] || 0) + each;
    }
  });
  out.share = out.ownPaid + out.byOthers;
  return out;
}

// The expenses behind the "Personal" figure in My spending: I paid it and only I share it.
// Their total always equals myFlows / buildStats "personal" for that person.
export const myPersonalExpenses = (list, me) => list.filter(e => isPersonal(e) && e.payer === me);