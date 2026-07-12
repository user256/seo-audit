import { CHECK_CATALOGUE } from '../lib/rules/check-catalogue';
import type { CheckAvailabilityContext, CheckDescriptor } from '../lib/rules/types';

export type CheckSelectionViewInput = {
  availability: CheckAvailabilityContext;
  selectedCheckIds: ReadonlySet<string>;
  catalogue?: readonly CheckDescriptor[];
  onSelectionChange: (checkId: string, selected: boolean) => void;
};

function consentCopy(check: CheckDescriptor): string | null {
  if (!check.optIn) return null;
  if (check.cost === 'network') {
    return 'Optional network check. It may make a request to the current origin; broad site access is never granted.';
  }
  return 'Experimental check. It needs your explicit selection and may request extra site access or make bounded network requests.';
}

/** Render the optional, keyboard-native check selection form. */
export function renderCheckSelectionView(host: HTMLElement, input: CheckSelectionViewInput): void {
  const catalogue = input.catalogue ?? CHECK_CATALOGUE;
  const categories = new Map<string, CheckDescriptor[]>();
  for (const check of catalogue) {
    const entries = categories.get(check.category) ?? [];
    entries.push(check);
    categories.set(check.category, entries);
  }

  host.replaceChildren();
  for (const [category, checks] of categories) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'check-category';
    const legend = document.createElement('legend');
    legend.textContent = category.replaceAll('-', ' ');
    fieldset.append(legend);

    for (const check of checks) {
      const availability = check.availability(input.availability);
      const row = document.createElement('div');
      row.className = 'check-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `check-${check.id}`;
      checkbox.name = 'audit-check';
      checkbox.value = check.id;
      checkbox.checked =
        availability.status === 'available' && input.selectedCheckIds.has(check.id);
      checkbox.disabled = availability.status !== 'available';
      checkbox.addEventListener('change', () =>
        input.onSelectionChange(check.id, checkbox.checked),
      );

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      const labelText = document.createElement('span');
      labelText.className = 'check-label';
      labelText.textContent = check.label;
      const badge = document.createElement('span');
      badge.className = 'check-cost';
      badge.textContent = check.cost;
      label.append(labelText, badge);

      const description = document.createElement('p');
      description.className = 'check-description';
      description.textContent = check.description;
      const detail = document.createElement('p');
      detail.className = availability.status === 'available' ? 'check-available' : 'check-reason';
      detail.textContent =
        availability.status === 'available' ? 'Available for this audit.' : availability.reason;

      const consent = consentCopy(check);
      if (consent) {
        const disclosure = document.createElement('p');
        disclosure.className = 'check-consent';
        disclosure.id = `${checkbox.id}-consent`;
        disclosure.textContent = consent;
        checkbox.setAttribute('aria-describedby', disclosure.id);
        row.append(checkbox, label, description, detail, disclosure);
      } else {
        row.append(checkbox, label, description, detail);
      }
      fieldset.append(row);
    }
    host.append(fieldset);
  }
}
