import React from 'react'

/**
 * A chain of steps, left to right, or top to bottom with `vertical` (the 8:9 canvas is narrow).
 * `loop` writes the return path under the chain.
 * nodes: [{ t: 'title', s: 'subtitle', hl: bool, ask: bool }]
 */
export default function Flow({ nodes, loop, width = '100%', small = false, vertical = false }) {
  return (
    <div className={`flow ${small ? 'small' : ''} ${vertical ? 'vertical' : ''}`} style={{ width }}>
      <div className="flow-row">
        {nodes.map((n, i) => (
          <React.Fragment key={i}>
            <div className={`flow-node ${n.hl ? 'hl' : ''} ${n.ask ? 'ask' : ''}`}>
              <div className="ft">{n.t}</div>
              {n.s && <div className="fs">{n.s}</div>}
            </div>
            {i < nodes.length - 1 && <div className="flow-arrow">{vertical ? '▼' : '→'}</div>}
          </React.Fragment>
        ))}
      </div>
      {loop && <div className="flow-loop">↺ {loop}</div>}
    </div>
  )
}
