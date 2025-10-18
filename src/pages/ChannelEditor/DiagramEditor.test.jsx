import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import DiagramEditor from './DiagramEditor.jsx';
import * as channelsApi from '../../services/channels.api.js';
import { useDiagramStore } from '../../store/useDiagramStore.js';

vi.mock('../../services/channels.api.js', () => ({
  useChannelsApi: () => ({
    getChannel: vi.fn().mockResolvedValue({ nodes: [], edges: [], meta: {} }),
    patchChannelNodes: vi.fn(),
    patchChannelEdges: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAutosave.js', () => ({
  useAutosave: () => {},
}));

vi.mock('../../hooks/useDirtyBlocker.js', () => ({
  useDirtyBlocker: () => {},
}));

describe('DiagramEditor', () => {
  beforeEach(() => {
    useDiagramStore.setState({ nodes: [], edges: [], selection: { type: null, item: null } });
  });

  it('renders canvas and inspector', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/channels/123' }]}> {
        <Routes>
          <Route path="/channels/:channelId" element={<DiagramEditor />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Palette')).toBeInTheDocument();
  });
});
