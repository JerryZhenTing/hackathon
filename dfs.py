# ─────────────────────────────────────────────
#  Naive Depth-First Search (DFS)
#  Works on a directed/undirected graph
#  represented as an adjacency list (dict).
# ─────────────────────────────────────────────

def dfs(graph, start):
    """
    Perform a naive iterative DFS starting from `start`.

    Parameters
    ----------
    graph : dict  – adjacency list  { node: [neighbours, ...] }
    start : node  – the node to begin traversal from

    Returns
    -------
    list – nodes in the order they were first visited
    """
    visited = set()
    order   = []
    stack   = [start]

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        # push neighbours in reverse so left-most neighbour is explored first
        for neighbour in reversed(graph.get(node, [])):
            if neighbour not in visited:
                stack.append(neighbour)

    return order


def dfs_recursive(graph, start, visited=None, order=None):
    """
    Recursive variant of DFS.

    Returns
    -------
    list – nodes in the order they were first visited
    """
    if visited is None:
        visited = set()
    if order is None:
        order = []

    visited.add(start)
    order.append(start)

    for neighbour in graph.get(start, []):
        if neighbour not in visited:
            dfs_recursive(graph, neighbour, visited, order)

    return order


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
    print("  Running DFS test cases")
    print("=" * 55)

    # ── Test 1: Simple linear chain  0 → 1 → 2 → 3
    graph1 = {0: [1], 1: [2], 2: [3], 3: []}
    check("T1  iterative  – linear chain",
          dfs(graph1, 0), [0, 1, 2, 3])
    check("T1  recursive  – linear chain",
          dfs_recursive(graph1, 0), [0, 1, 2, 3])

    # ── Test 2: Binary tree
    #        1
    #       / \
    #      2   3
    #     / \
    #    4   5
    graph2 = {1: [2, 3], 2: [4, 5], 3: [], 4: [], 5: []}
    check("T2  iterative  – binary tree",
          dfs(graph2, 1), [1, 2, 4, 5, 3])
    check("T2  recursive  – binary tree",
          dfs_recursive(graph2, 1), [1, 2, 4, 5, 3])

    # ── Test 3: Graph with a cycle  0 ↔ 1 ↔ 2 ↔ 0
    graph3 = {0: [1, 2], 1: [0, 2], 2: [0, 1]}
    check("T3  iterative  – cycle (no infinite loop)",
          dfs(graph3, 0), [0, 1, 2])
    check("T3  recursive  – cycle (no infinite loop)",
          dfs_recursive(graph3, 0), [0, 1, 2])

    # ── Test 4: Disconnected graph – DFS only reaches connected component
    graph4 = {0: [1], 1: [0], 2: [3], 3: [2]}   # two separate components
    check("T4  iterative  – disconnected (component of 0)",
          dfs(graph4, 0), [0, 1])
    check("T4  recursive  – disconnected (component of 0)",
          dfs_recursive(graph4, 0), [0, 1])
    check("T4  iterative  – disconnected (component of 2)",
          dfs(graph4, 2), [2, 3])

    # ── Test 5: Single node, no edges
    graph5 = {42: []}
    check("T5  iterative  – single node",
          dfs(graph5, 42), [42])
    check("T5  recursive  – single node",
          dfs_recursive(graph5, 42), [42])

    # ── Test 6: Node with self-loop
    graph6 = {0: [0, 1], 1: []}
    check("T6  iterative  – self-loop",
          dfs(graph6, 0), [0, 1])
    check("T6  recursive  – self-loop",
          dfs_recursive(graph6, 0), [0, 1])

    # ── Test 7: Deeper graph  A→B→D→F, A→C→E
    graph7 = {
        'A': ['B', 'C'],
        'B': ['D'],
        'C': ['E'],
        'D': ['F'],
        'E': [],
        'F': [],
    }
    check("T7  iterative  – deeper mixed graph",
          dfs(graph7, 'A'), ['A', 'B', 'D', 'F', 'C', 'E'])
    check("T7  recursive  – deeper mixed graph",
          dfs_recursive(graph7, 'A'), ['A', 'B', 'D', 'F', 'C', 'E'])

    print("-" * 55)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 55)


if __name__ == "__main__":
    run_tests()
