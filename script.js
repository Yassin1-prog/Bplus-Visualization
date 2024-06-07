class Node {
  constructor(order) {
    this.order = order;
    this.values = []; // Stores keys/values in the node
    this.children = []; // Stores references to child nodes
    this.nextKey = null; // Reference to the next leaf node (for leaf nodes)
    this.parent = null; // Reference to the parent node
    this.check_leaf = false; // Indicates if the node is a leaf

    // Minimum and maximum number of children (for internal nodes) and values (for leaf nodes) allowed in the node
    this.minChildren = Math.ceil(order / 2);
    this.maxChildren = order;
    this.minValues = Math.ceil((order - 1) / 2);
    this.maxValues = order - 1;
  }

  // Insert a value in the correct position within a leaf node
  insert_at_leaf(value) {
    const pos = this.values.findIndex((v) => v > value);
    if (pos === -1) {
      this.values.push(value);
    } else {
      this.values.splice(pos, 0, value);
    }
  }

  // Delete a value from a leaf node
  delete_from_leaf(value) {
    const index = this.values.indexOf(value);
    if (index !== -1) {
      this.values.splice(index, 1);
    }
  }
}

class BplusTree {
  constructor(order) {
    this.root = new Node(order);
    this.root.check_leaf = true; // The initial root is a leaf
  }

  // Insert a value into the B+ tree
  insert(value) {
    const leaf = this.search(value);
    leaf.insert_at_leaf(value);

    if (leaf.values.length > leaf.maxValues) {
      this.split_leaf_node(leaf);
    }
  }

  // Delete a value from the B+ tree
  delete(value) {
    const node = this.search(value);
    node.delete_from_leaf(value);

    if (node.values.length < node.minValues) {
      this.fix_node(node);
    }
  }

  // Fix a node that has too few values (either merging or redistribution)
  fix_node(node) {
    if (node === this.root) {
      if (node.values.length === 0 && node.children.length > 0) {
        this.root = node.children[0];
        this.root.parent = null;
      }
      return;
    }

    const parent = node.parent;
    const index = parent.children.indexOf(node);

    let leftSibling = null,
      rightSibling = null;
    if (index > 0) {
      leftSibling = parent.children[index - 1];
    }
    if (index < parent.children.length - 1) {
      rightSibling = parent.children[index + 1];
    }

    if (leftSibling && leftSibling.values.length > leftSibling.minValues) {
      this.redistribute_nodes(leftSibling, node);
    } else if (
      rightSibling &&
      rightSibling.values.length > rightSibling.minValues
    ) {
      this.redistribute_nodes(node, rightSibling);
    } else if (leftSibling) {
      this.merge_nodes(leftSibling, node);
    } else if (rightSibling) {
      this.merge_nodes(node, rightSibling);
    }
  }

  // Merge two nodes into one
  merge_nodes(leftNode, rightNode) {
    leftNode.values.push(...rightNode.values);
    leftNode.children.push(...rightNode.children);
    leftNode.nextKey = rightNode.nextKey;

    const parent = leftNode.parent;
    const index = parent.children.indexOf(rightNode);
    parent.children.splice(index, 1); // remove rightNode from parent
    parent.values.splice(index - 1, 1); // remove the value corresponding to rightNode

    if (parent.values.length < parent.minValues && parent !== this.root) {
      this.fix_node(parent);
    }
  }

  // Search for the leaf node that should contain the given value
  search(value) {
    let current_node = this.root;
    while (!current_node.check_leaf) {
      let i = 0;
      while (
        i < current_node.values.length &&
        value >= current_node.values[i]
      ) {
        i++;
      }
      current_node = current_node.children[i];
    }
    return current_node;
  }

  // Find if a value exists in the B+ tree
  find(value) {
    const l = this.search(value);
    return l.values.includes(value);
  }

  // Insert a new key and node into the parent node
  insert_in_parent(n, k, ndash) {
    if (!n.parent) {
      const new_root = new Node(n.order);
      new_root.values = [k];
      new_root.children = [n, ndash];
      n.parent = new_root;
      ndash.parent = new_root;
      this.root = new_root;
      return;
    }

    const parentNode = n.parent;
    const temp3 = parentNode.children;
    for (let i = 0; i < temp3.length; i++) {
      if (temp3[i] === n) {
        parentNode.values.splice(i, 0, k);
        parentNode.children.splice(i + 1, 0, ndash);
        ndash.parent = parentNode;
        if (parentNode.children.length > parentNode.order) {
          this.split_internal_node(parentNode);
        }
        return;
      }
    }
  }

  // Split a leaf node that has too many values
  split_leaf_node(node) {
    const mid = Math.ceil(node.values.length / 2);
    const new_node = new Node(node.order);
    new_node.check_leaf = true;
    new_node.values = node.values.slice(mid);
    new_node.nextKey = node.nextKey;

    node.values = node.values.slice(0, mid);
    node.nextKey = new_node;

    new_node.parent = node.parent;

    const k = new_node.values[0];
    if (node.parent) {
      this.insert_in_parent(node, k, new_node);
    } else {
      const new_root = new Node(node.order);
      new_root.values = [k];
      new_root.children = [node, new_node];
      node.parent = new_root;
      new_node.parent = new_root;
      this.root = new_root;
    }
  }

  // Split an internal node that has too many values
  split_internal_node(node) {
    const mid = Math.ceil((node.values.length - 1) / 2);
    const new_node = new Node(node.order);

    new_node.values = node.values.slice(mid + 1);
    new_node.children = node.children.slice(mid + 1);

    const k = node.values[mid];

    node.values = node.values.slice(0, mid);
    node.children = node.children.slice(0, mid + 1);

    new_node.parent = node.parent;
    for (const child of new_node.children) {
      child.parent = new_node;
    }

    if (node.parent) {
      this.insert_in_parent(node, k, new_node);
    } else {
      const new_root = new Node(node.order);
      new_root.values = [k];
      new_root.children = [node, new_node];
      node.parent = new_root;
      new_node.parent = new_root;
      this.root = new_root;
    }
  }

  // Redistribute values between two nodes to balance them
  redistribute_nodes(leftNode, rightNode) {
    const parent = leftNode.parent;
    const index = parent.children.indexOf(rightNode);

    if (leftNode.values.length > rightNode.values.length) {
      rightNode.values.unshift(leftNode.values.pop());
      parent.values[index - 1] = rightNode.values[0];
    } else {
      leftNode.values.push(rightNode.values.shift());
      parent.values[index - 1] = rightNode.values[0];
    }
  }
}

// Function to print the tree (for debugging and visualization)
function printTree(tree) {
  let nodes = [tree.root];
  let level = [0];

  while (nodes.length) {
    const currentNode = nodes.shift();
    const currentLevel = level.shift();
    console.log(`Level ${currentLevel}: ${currentNode.values}`);
    if (!currentNode.check_leaf) {
      nodes.push(...currentNode.children);
      level.push(...Array(currentNode.children.length).fill(currentLevel + 1));
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const reset = document.querySelector(".reset");
  const insert = document.querySelector(".insert");
  const remove = document.querySelector(".delete");
  const keyToInsert = document.querySelector("#ikey");
  const keyToDelete = document.querySelector("#dkey");
  const degree = document.querySelector("#dropdown");
  const treeContainer = document.createElement("div");
  document.body.appendChild(treeContainer);

  let bplustree = new BplusTree(parseInt(degree.value));

  // Reset the tree to its initial state
  reset.addEventListener("click", () => {
    window.location.reload();
  });

  // Insert a value into the tree and visualize it
  insert.addEventListener("click", () => {
    const ikeyValue = parseInt(keyToInsert.value);
    if (ikeyValue) {
      bplustree.insert(ikeyValue);
      visualizeTree();
    }
    keyToInsert.value = "";
  });

  // Remove a value from the tree and visualize it
  remove.addEventListener("click", () => {
    const dkeyValue = parseInt(keyToDelete.value);
    if (dkeyValue) {
      bplustree.delete(dkeyValue);
      visualizeTree();
    }
    keyToDelete.value = "";
  });

  // Change the degree/order of the tree and reset visualization
  degree.addEventListener("change", () => {
    treeContainer.innerHTML = "";
    bplustree = new BplusTree(parseInt(degree.value));
  });

  // Visualize the current state of the B+ tree
  function visualizeTree() {
    treeContainer.innerHTML = ""; // Clear previous visualization
    const queue = [{ node: bplustree.root, level: 0 }];
    let currentLevel = 0;
    let levelDiv = document.createElement("div");
    levelDiv.className = "level";
    treeContainer.appendChild(levelDiv);

    while (queue.length > 0) {
      const { node, level } = queue.shift();

      if (level !== currentLevel) {
        currentLevel = level;
        levelDiv = document.createElement("div");
        levelDiv.className = "level";
        treeContainer.appendChild(levelDiv);
      }

      const nodeDiv = document.createElement("div");
      nodeDiv.className = "node";
      node.values.forEach((value, index) => {
        const valueSpan = document.createElement("span");
        valueSpan.textContent = value;
        nodeDiv.appendChild(valueSpan);
      });
      levelDiv.appendChild(nodeDiv);

      if (!node.check_leaf) {
        for (const child of node.children) {
          queue.push({ node: child, level: level + 1 });
        }
      }
    }
  }

  // Initial visualization
  visualizeTree();
});
