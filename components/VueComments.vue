<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps(['post_id', 'endpoint', 'api_key']);

const comments = ref([]);
const loading = ref(true);
const submitting = ref(false);
const message = ref('');

// Fetch comments using the headless comments API
const fetchComments = async () => {
  try {
    const response = await fetch(
        `${props.endpoint}/wp-json/headless-comments/v1/posts/${props.post_id}/comments`,
        {
          headers: {
            'X-API-Key': props.api_key
          }
        }
    );

    if (response.ok) {
      comments.value = await response.json();
    } else {
      console.error('Failed to fetch comments:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
  } finally {
    loading.value = false;
  }
};

// Submit comment using the headless comments API
const submitComment = async (event) => {
  event.preventDefault();
  submitting.value = true;
  message.value = '';

  const formData = new FormData(event.target);
  const commentData = {
    author_name: formData.get('author_name'),
    author_email: formData.get('author_email'),
    content: formData.get('content'),
    parent: formData.get('parent') || 0
  };

  try {
    const response = await fetch(
        `${props.endpoint}/wp-json/headless-comments/v1/posts/${props.post_id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': props.api_key
          },
          body: JSON.stringify(commentData)
        }
    );

    if (response.ok) {
      const result = await response.json();
      message.value = result.message || 'Comment submitted successfully!';
      event.target.reset();

      // Refresh comments if auto-approved
      if (result.approved) {
        await fetchComments();
      }
    } else {
      const error = await response.json();
      message.value = error.message || 'Error submitting comment. Please try again.';
    }
  } catch (error) {
    message.value = 'Error submitting comment. Please try again.';
    console.error('Submit error:', error);
  } finally {
    submitting.value = false;
  }
};

// Format date helper
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

onMounted(() => {
  fetchComments();
});
</script>

<template>
  <section class="comments-section">
    <h3>Comments</h3>

    <!-- Loading State -->
    <div v-if="loading" class="loading">Loading comments...</div>

    <!-- Comments List -->
    <div v-else-if="comments.length > 0" class="comments-list">
      <div v-for="comment in comments" :key="comment.id" class="comment">
        <div class="comment-author">
          <strong>{{ comment.author_name }}</strong>
        </div>
        <div class="comment-date">
          {{ formatDate(comment.date) }}
        </div>
        <div class="comment-content" v-html="comment.content"></div>
      </div>
    </div>

    <!-- No Comments -->
    <div v-else class="no-comments">
      <p>No comments yet. Be the first to comment!</p>
    </div>

    <!-- Comment Form -->
    <div class="comment-form">
      <h4>Leave a Comment</h4>

      <div v-if="message" class="message" :class="{ success: message.includes('successfully'), error: !message.includes('successfully') }">
        {{ message }}
      </div>

      <form @submit="submitComment">
        <div class="form-group">
          <label for="author_name">Name *</label>
          <input type="text" id="author_name" name="author_name" required>
        </div>

        <div class="form-group">
          <label for="author_email">Email *</label>
          <input type="email" id="author_email" name="author_email" required>
        </div>

        <div class="form-group">
          <label for="content">Comment *</label>
          <textarea id="content" name="content" rows="5" required></textarea>
        </div>

        <input type="hidden" name="parent" value="0">

        <button type="submit" :disabled="submitting" class="submit-btn">
          {{ submitting ? 'Submitting...' : 'Submit Comment' }}
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.comments-section {
  margin: 3rem 0;
  padding: 2rem 0;
  border-top: 1px solid #eee;
}

.loading {
  text-align: center;
  color: #666;
  font-style: italic;
}

.comments-list {
  margin: 2rem 0;
}

.comment {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 5px;
}

.comment-author {
  font-weight: bold;
  color: #333;
}

.comment-date {
  font-size: 0.85rem;
  color: #666;
  margin: 0.25rem 0;
}

.comment-content {
  margin-top: 0.5rem;
  line-height: 1.6;
}

.no-comments {
  text-align: center;
  color: #666;
  font-style: italic;
  margin: 2rem 0;
}

.comment-form {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
}

.form-group {
  margin: 1rem 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.submit-btn {
  background: #0066cc;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.submit-btn:hover:not(:disabled) {
  background: #0052a3;
}

.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.message {
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>
