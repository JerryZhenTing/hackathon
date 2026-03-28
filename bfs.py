# ─────────────────────────────────────────────
#  Breadth-First Search (BFS)
#  Works on a directed/undirected graph
#  represented as an adjacency list (dict).
# ─────────────────────────────────────────────

from collections import deque


def bfs(graph, start):
    """
    Perform an iterative BFS starting from `start`.

    Uses a deque as a FIFO queue: neighbours are enqueued at the
    right and dequeued from the left, guaranteeing that every node
    at distance k is visited before any node at distance k+1.

    Parameters
    ----------
    graph : dict  – adjacency list  { node: [neighbours, ...] }
    start : node  – the node to begin traversal from

    Returns
    -------
    list – nodes in the order they were first visited (level by level)
    """
    visited = set()
    order   = []
    queue   = deque([start])
    visited.add(start)

    while queue:
        node = queue.popleft()          # FIFO – dequeue from the front
        order.append(node)
        for neighbour in graph.get(node, []):
            if neighbour not in visited:
                visited.add(neighbour)  # mark on enqueue to avoid duplicates
                queue.append(neighbour)

    return order


def bfs_level_order(graph, start):
    """
    BFS variant that returns nodes grouped by level (distance from start).

    Instead of a flat list this function returns a list of lists, where
    result[k] contains every node that is exactly k hops away from start.

    Parameters
    ----------
    graph : dict  – adjacency list  { node: [neighbours, ...] }
    start : node  – the node to begin traversal from

    Returns
    -------
    list[list] – e.g. [[start], [level-1 nodes], [level-2 nodes], ...]
    """
    visited = set([start])
    levels  = [[start]]

    while levels[-1]:               # keep going while the last level is non-empty
        next_level = []
        for node in levels[-1]:
            for neighbour in graph.get(node, []):
                if neighbour not in visited:
                    visited.add(neighbour)
                    next_level.append(neighbour)
        if next_level:
            levels.append(next_level)
        else:
            break                   # no new nodes discovered – traversal complete

    return levels


# ─────────────────────────────────────────────
#  TEST CASES
# ─────────────────────────────────────────────

def run_tests():
    passed = 0
    failed = 0

    def check(name, result, expected):
        nonlocal passed, failed
        if result == expected:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name}")
            print(f"         expected : {expected}")
            print(f"         got      : {result}")
            failed += 1

    print("=" * 55)
    print("  Running BFS test cases")
    print("=" * 55)

    # ── Test 1: Simple linear chain  0 → 1 → 2 → 3
    graph1 = {0: [1], 1: [2], 2: [3], 3: []}
    check("T1  iterative   – linear chain",
          bfs(graph1, 0), [0, 1, 2, 3])
    check("T1  level-order – linear chain",
          bfs_level_order(graph1, 0), [[0], [1], [2], [3]])

    # ── Test 2: Binary tree
    #        1
    #       / \
    #      2   3
    #     / \
    #    4   5
    # BFS visits 1, then 2 & 3 (level 1), then 4 & 5 (level 2)
    graph2 = {1: [2, 3], 2: [4, 5], 3: [], 4: [], 5: []}
    check("T2  iterative   – binary tree",
          bfs(graph2, 1), [1, 2, 3, 4, 5])
    check("T2  level-order – binary tree",
          bfs_level_order(graph2, 1), [[1], [2, 3], [4, 5]])

    # ── Test 3: Graph with a cycle  0 ↔ 1 ↔ 2 ↔ 0
    graph3 = {0: [1, 2], 1: [0, 2], 2: [0, 1]}
    check("T3  iterative   – cycle (no infinite loop)",
          bfs(graph3, 0), [0, 1, 2])
    check("T3  level-order – cycle (no infinite loop)",
          bfs_level_order(graph3, 0), [[0], [1, 2]])

    # ── Test 4: Disconnected graph – BFS only reaches connected component
    graph4 = {0: [1], 1: [0], 2: [3], 3: [2]}   # two separate components
    check("T4  iterative   – disconnected (component of 0)",
          bfs(graph4, 0), [0, 1])
    check("T4  level-order – disconnected (component of 0)",
          bfs_level_order(graph4, 0), [[0], [1]])
    check("T4  iterative   – disconnected (component of 2)",
          bfs(graph4, 2), [2, 3])

    # ── Test 5: Single node, no edges
    graph5 = {42: []}
    check("T5  iterative   – single node",
          bfs(graph5, 42), [42])
    check("T5  level-order – single node",
          bfs_level_order(graph5, 42), [[42]])

    # ── Test 6: Node with self-loop
    graph6 = {0: [0, 1], 1: []}
    check("T6  iterative   – self-loop",
          bfs(graph6, 0), [0, 1])
    check("T6  level-order – self-loop",
          bfs_level_order(graph6, 0), [[0], [1]])

    # ── Test 7: Deeper graph  A→B→D→F, A→C→E
    # BFS: level-0=[A], level-1=[B,C], level-2=[D,E], level-3=[F]
    graph7 = {
        'A': ['B', 'C'],
        'B': ['D'],
        'C': ['E'],
        'D': ['F'],
        'E': [],
        'F': [],
    }
    check("T7  iterative   – deeper mixed graph",
          bfs(graph7, 'A'), ['A', 'B', 'C', 'D', 'E', 'F'])
    check("T7  level-order – deeper mixed graph",
          bfs_level_order(graph7, 'A'),
          [['A'], ['B', 'C'], ['D', 'E'], ['F']])

    print("-" * 55)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 55)


if __name__ == "__main__":
    run_tests()
