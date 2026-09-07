import { Header, Screen } from '../components.js'
import { type DocumentMode, useNavigation } from '../navigation.js'
import { DocumentForm } from './document-form.js'

export function AddDocument({ initial }: { initial?: DocumentMode }) {
  const nav = useNavigation()
  return (
    <Screen>
      <Header title="Add a document" onBack={nav.back} />
      <DocumentForm initial={initial} onSaved={() => nav.back()} />
    </Screen>
  )
}
